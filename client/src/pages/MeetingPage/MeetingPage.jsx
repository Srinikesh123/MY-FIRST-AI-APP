import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUser } from '../../contexts/UserContext';
import { io } from 'socket.io-client';
import AnnotationCanvas from './AnnotationCanvas';
import MeetingChat from './MeetingChat';
import './MeetingPage.css';

// ─── ICE Servers (fetched from server — includes Metered TURN) ───────────────
let ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
let HAS_TURN = false; // whether we have working TURN relay servers

async function fetchIceServers() {
  try {
    const res = await fetch('/api/turn-credentials');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    if (data.iceServers?.length) {
      ICE_SERVERS = data.iceServers;
      HAS_TURN = data.hasTurn === true;
      const turnCount = data.iceServers.filter(s => s.urls?.toString().includes('turn')).length;
      console.log(`✅ ICE servers: ${data.iceServers.length} total, ${turnCount} TURN relays, hasTurn=${HAS_TURN}`);
    }
    return HAS_TURN;
  } catch (err) {
    console.error('❌ TURN fetch failed:', err.message);
    return false;
  }
}

// TURN credentials expire (~10 min for Metered.ca). Refresh every 4 minutes
// so long sessions (2+ hours) never use stale credentials.
const ICE_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes

// ─── Set encoder bitrate for high quality screen sharing ────────────────────
async function setMaxBitrate(pc, kbps = 8000) {
  const senders = pc.getSenders().filter(s => s.track?.kind === 'video');
  for (const sender of senders) {
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = kbps * 1000;
      params.encodings[0].maxFramerate = 30;
      await sender.setParameters(params);
    } catch (_) {}
  }
}

export default function MeetingPage() {
  const { user } = useAuth();
  const { username } = useUser();

  // ─── State ────────────────────────────────────────────────────────────────
  const [view, setView] = useState('lobby');
  const [joinCode, setJoinCode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [peers, setPeers] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [copied, setCopied] = useState(false);
  const [controlRequest, setControlRequest] = useState(null);
  const [remoteControlActive, setRemoteControlActive] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState(null); // {x, y} normalized 0-1
  const [networkStats, setNetworkStats] = useState(null); // fps, bitrate
  const [sessionTime, setSessionTime] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [knockQueue, setKnockQueue] = useState([]); // guests waiting to be admitted
  const [remoteScreenStream, setRemoteScreenStream] = useState(null); // incoming screen share stream

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const socketRef        = useRef(null);
  const peerConnsRef     = useRef(new Map()); // socketId → RTCPeerConnection
  const dataChannelsRef  = useRef(new Map()); // socketId → RTCDataChannel
  const localStreamRef   = useRef(null);
  const screenStreamRef  = useRef(null);
  const offerToPeerRef   = useRef(null); // ref so setupSocketListeners can call it without circular dep
  const remoteVideosRef  = useRef(new Map());
  const localVideoRef    = useRef(null);
  const screenVideoRef   = useRef(null);
  const remoteScreenRef  = useRef(null); // incoming screen share from others
  const roomCodeRef      = useRef('');
  const containerRef     = useRef(null);
  const statsTimerRef    = useRef(null);
  const sessionTimerRef  = useRef(null);

  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);

  // Session timer — keep alive counter for 2+ hour sessions
  useEffect(() => {
    if (view === 'meeting') {
      sessionTimerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    } else {
      clearInterval(sessionTimerRef.current);
      setSessionTime(0);
    }
    return () => clearInterval(sessionTimerRef.current);
  }, [view]);

  // ─── Refresh TURN credentials periodically for long sessions ──────────────
  useEffect(() => {
    if (view !== 'meeting') return;
    const timer = setInterval(async () => {
      console.log('🔄 Refreshing TURN credentials for long session...');
      await fetchIceServers();
      // Update ICE config on all active peer connections so new candidates use fresh TURN
      for (const [peerId, pc] of peerConnsRef.current) {
        try {
          pc.setConfiguration({ iceServers: ICE_SERVERS, iceTransportPolicy: 'all', bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
        } catch (e) { console.warn(`Could not update ICE config for ${peerId}:`, e.message); }
      }
    }, ICE_REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [view]);

  // ─── Network change detection — auto-reconnect on WiFi/mobile switch ──────
  useEffect(() => {
    if (view !== 'meeting') return;
    const handleOnline = () => {
      console.log('🌐 Network came back online — restarting ICE on all peers');
      setError('');
      // Refresh TURN credentials first, then restart ICE
      fetchIceServers().then(() => {
        for (const [, pc] of peerConnsRef.current) {
          try {
            pc.setConfiguration({ iceServers: ICE_SERVERS, iceTransportPolicy: 'all', bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
            pc.restartIce();
          } catch (_) {}
        }
      });
    };
    const handleOffline = () => {
      setError('Network lost — will reconnect automatically when back online');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [view]);

  // ─── Attach remote screen stream when video element mounts ────────────────
  // Runs when the stream arrives OR when peers change (video element mounts after
  // peer-screen-sharing event). Covers every timing order.
  const hasRemoteScreenForEffect = peers.some(p => p.isScreenSharing);
  useEffect(() => {
    if (!remoteScreenStream) return;
    // Small delay to let React commit the DOM (callback ref sets remoteScreenRef)
    const timer = setTimeout(() => {
      if (remoteScreenRef.current) {
        remoteScreenRef.current.srcObject = remoteScreenStream;
        remoteScreenRef.current.play().catch(() => {});
        console.log('📺 Attached remote screen stream via useEffect');
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [remoteScreenStream, hasRemoteScreenForEffect]);

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  // ─── Stats monitor ────────────────────────────────────────────────────────
  const startStatsMonitor = useCallback((pc) => {
    clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let fps = 0, bitrate = 0;
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            fps = Math.round(report.framesPerSecond || 0);
            bitrate = Math.round((report.bytesSent || 0) * 8 / 1000);
          }
        });
        setNetworkStats({ fps, bitrate });
      } catch (_) {}
    }, 2000);
  }, []);

  // ─── Data channel (remote control + cursor) ───────────────────────────────
  const setupDataChannel = useCallback((dc, peerId) => {
    dataChannelsRef.current.set(peerId, dc);
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'cursor') {
          setRemoteCursor({ x: msg.x, y: msg.y });
        } else if (msg.type === 'control-event' && remoteControlActive) {
          // Execute remote control events on the screen share video overlay
          // (browser sandbox: we can move a virtual cursor overlay, not OS cursor)
          handleRemoteControlEvent(msg);
        }
      } catch (_) {}
    };
    dc.onerror = (e) => console.warn('DataChannel error:', e);
  }, [remoteControlActive]);

  const handleRemoteControlEvent = (msg) => {
    // In a browser we cannot control the OS, but we relay cursor position
    // for a "virtual cursor overlay" effect. Real OS control needs a desktop agent.
    if (msg.type === 'control-event') {
      setRemoteCursor({ x: msg.x, y: msg.y });
    }
  };

  // ─── Send cursor position to peers ────────────────────────────────────────
  const sendCursorPosition = useCallback((e) => {
    if (!isScreenSharing) return;
    const video = screenVideoRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const msg = JSON.stringify({ type: 'cursor', x, y });
    dataChannelsRef.current.forEach(dc => {
      if (dc.readyState === 'open') dc.send(msg);
    });
  }, [isScreenSharing]);

  // ─── Build RTCPeerConnection ───────────────────────────────────────────────
  const buildPeerConnection = useCallback((peerId, socket, isInitiator = false) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Data channel for remote control + cursor
    if (isInitiator) {
      const dc = pc.createDataChannel('control', { ordered: true });
      setupDataChannel(dc, peerId);
    } else {
      pc.ondatachannel = (e) => setupDataChannel(e.channel, peerId);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('signal', { to: peerId, signal: e.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`ICE [${peerId}]: ${state}`);
      if (state === 'connected' || state === 'completed') {
        // Log which candidate pair won (relay = TURN, srflx/host = direct)
        pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const local = stats.get(report.localCandidateId);
              const remote = stats.get(report.remoteCandidateId);
              console.log(`✅ Connected via: local=${local?.candidateType} remote=${remote?.candidateType} (relay = TURN server, srflx/host = direct)`);
            }
          });
        }).catch(() => {});
      }
      if (state === 'failed') {
        console.error('❌ ICE failed — refreshing TURN creds and restarting');
        // Get fresh TURN credentials and restart ICE
        fetchIceServers().then(() => {
          try {
            pc.setConfiguration({ iceServers: ICE_SERVERS, iceTransportPolicy: 'all', bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
          } catch (_) {}
          pc.restartIce();
        });
      }
    };

    pc.ontrack = (e) => {
      const track = e.track;
      // e.streams[0] can be undefined when a transceiver is reused — always
      // fall back to a fresh MediaStream built from the track itself.
      const stream = e.streams[0] || new MediaStream([track]);
      remoteVideosRef.current.set(peerId, stream);

      if (track.kind === 'audio') {
        let audioEl = document.getElementById(`remote-audio-${peerId}`);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `remote-audio-${peerId}`;
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {});
      }

      if (track.kind === 'video') {
        // The video track may arrive muted (transceiver reuse / early negotiation).
        // Attach when it actually becomes active.
        const attachScreenStream = () => {
          console.log(`📺 Video track active from ${peerId}, muted=${track.muted}`);
          const s = new MediaStream([track]);
          setRemoteScreenStream(s);
          if (remoteScreenRef.current) {
            remoteScreenRef.current.srcObject = s;
            remoteScreenRef.current.play().catch(() => {});
          }
        };

        if (!track.muted && track.readyState === 'live') {
          attachScreenStream();
        }
        // Also listen for unmute — fires when track starts delivering frames
        track.onunmute = attachScreenStream;
      }

      setPeers(prev => [...prev]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setMaxBitrate(pc, 8000); // 8 Mbps for crystal clear screen share
        startStatsMonitor(pc);
      }
    };

    // Add existing local tracks
    const stream = screenStreamRef.current || localStreamRef.current;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

    return pc;
  }, [setupDataChannel, startStatsMonitor]);

  // ─── Socket ────────────────────────────────────────────────────────────────
  const connectSocket = useCallback(() => new Promise((resolve, reject) => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      timeout: 15000,
      reconnection: true,
      reconnectionAttempts: Infinity, // never give up — 2+ hour sessions
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      pingTimeout: 30000,      // tolerate 30s silence before assuming disconnect
      pingInterval: 15000,     // heartbeat every 15s to keep connection alive
    });
    socketRef.current = socket;

    const timer = setTimeout(() => {
      socket.off('connect'); socket.off('connect_error');
      reject(new Error('Connection timed out. Please try again.'));
    }, 10000);

    socket.once('connect', () => { clearTimeout(timer); socket.off('connect_error'); resolve(socket); });
    socket.once('connect_error', (err) => { clearTimeout(timer); socket.off('connect'); reject(new Error('Could not connect: ' + err.message)); });
  }), []);

  const setupSocketListeners = useCallback((socket) => {
    socket.on('room-peers', (list) => setPeers(list.filter(p => p.socketId !== socket.id)));

    socket.on('signal', async ({ from, signal }) => {
      let pc = peerConnsRef.current.get(from);
      if (!pc) {
        pc = buildPeerConnection(from, socket, false);
        peerConnsRef.current.set(from, pc);
      }
      try {
        if (signal.type === 'offer') {
          // ── Handle offer collision (glare) ──
          // Both sides sent offers at the same time. Use "polite peer" pattern:
          // the peer with the LOWER socket ID is "polite" and yields.
          if (pc.signalingState !== 'stable') {
            const polite = socket.id < from;
            if (!polite) {
              console.log(`⚡ Ignoring colliding offer from ${from} (we take priority)`);
              return;
            }
            console.log(`⚡ Rolling back our offer — accepting ${from}'s offer`);
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, signal: answer });
        } else if (signal.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          }
        } else if (signal.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal)); } catch (_) {}
        }
      } catch (err) {
        console.error('Signal error:', err);
      }
    });

    socket.on('peer-left', ({ socketId }) => {
      peerConnsRef.current.get(socketId)?.close();
      peerConnsRef.current.delete(socketId);
      dataChannelsRef.current.delete(socketId);
      remoteVideosRef.current.delete(socketId);
      // Clean up hidden audio element
      document.getElementById(`remote-audio-${socketId}`)?.remove();
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
    });

    socket.on('meeting-chat', (msg) => setChatMessages(prev => [...prev, msg]));
    socket.on('chat-history', (h) => setChatMessages(h));
    socket.on('peer-screen-sharing', ({ socketId, sharing }) => {
      setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, isScreenSharing: sharing } : p));
      if (!sharing) setRemoteScreenStream(null);
    });
    socket.on('control-request', ({ from, username: u }) => setControlRequest({ from, username: u }));
    socket.on('control-granted', () => { setRemoteControlActive(true); setError('Remote control granted!'); });
    socket.on('control-denied', () => setError('Remote control denied'));

    // ── Waiting room / host approval ──────────────────────────────────────
    socket.on('knock', ({ socketId, username: knocker }) => {
      // Host receives knock — add to queue
      setKnockQueue(prev => [...prev.filter(k => k.socketId !== socketId), { socketId, username: knocker }]);
    });
    socket.on('admitted', ({ peers: peerList, chat }) => {
      // Guest was admitted by host
      setChatMessages(chat || []);
      const others = peerList.filter(p => p.socketId !== socket.id);
      setPeers(others);
      setView('meeting');
      setConnecting(false);
      // Offer to all existing peers — use ref to avoid circular dependency crash
      others.forEach(p => offerToPeerRef.current?.(p.socketId));
    });
    socket.on('denied', () => {
      setView('lobby');
      setConnecting(false);
      setError('The host did not admit you. Try again or check the code.');
      socket.disconnect();
    });
    socket.on('promoted-to-host', () => setIsHost(true));

    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        console.warn('Socket disconnected:', reason);
        setError('Disconnected. Reconnecting...');
      }
    });

    // Auto re-join room after socket reconnects (network blip, server restart)
    socket.on('reconnect', () => {
      console.log('🔄 Socket reconnected — re-joining room');
      setError('');
      const code = roomCodeRef.current;
      if (code) {
        socket.emit('rejoin-room', { roomCode: code, userId: user?.id, username }, (res) => {
          if (res?.success) {
            console.log('✅ Re-joined room after reconnect');
            // Rebuild peer connections with fresh ICE
            fetchIceServers().then(() => {
              const others = (res.peers || []).filter(p => p.socketId !== socket.id);
              setPeers(others);
              // Close stale connections and re-offer
              peerConnsRef.current.forEach(pc => pc.close());
              peerConnsRef.current.clear();
              dataChannelsRef.current.clear();
              others.forEach(p => offerToPeerRef.current?.(p.socketId));
            });
          } else {
            console.error('Re-join failed:', res?.error);
            setError('Reconnected but could not re-join room. Try leaving and re-joining.');
          }
        });
      }
    });
  }, [buildPeerConnection, user?.id, username]);

  const offerToPeer = useCallback(async (peerId) => {
    const socket = socketRef.current;
    if (!socket) return;
    let pc = peerConnsRef.current.get(peerId);
    if (!pc) {
      pc = buildPeerConnection(peerId, socket, true);
      peerConnsRef.current.set(peerId, pc);
    }
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: peerId, signal: offer });
    } catch (err) {
      console.error('Offer failed:', err);
    }
  }, [buildPeerConnection]);
  // Keep ref in sync so setupSocketListeners can call offerToPeer without circular dep
  offerToPeerRef.current = offerToPeer;

  useEffect(() => {
    if (view !== 'meeting') return;
    peers.forEach(p => { if (!peerConnsRef.current.has(p.socketId)) offerToPeer(p.socketId); });
  }, [peers, view, offerToPeer]);

  // ─── Acquire mic BEFORE entering meeting so buildPeerConnection has audio ──
  const acquireMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setIsMuted(false);
      return stream;
    } catch (_) {
      // Mic denied — continue without audio
      return null;
    }
  };

  // ─── Create / Join ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (connecting) return;
    setError(''); setConnecting(true);
    try {
      const [hasTurn] = await Promise.all([fetchIceServers(), acquireMic()]);
      if (!hasTurn) console.warn('⚠️ No TURN servers — cross-network may fail');
      const socket = await connectSocket();
      setupSocketListeners(socket);
      const res = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Server did not respond. Try again.')), 8000);
        socket.emit('create-room', { userId: user?.id, username }, (d) => { clearTimeout(t); resolve(d); });
      });
      if (!res.success) throw new Error(res.error || 'Failed to create room');
      setRoomCode(res.roomCode);
      setIsHost(true);
      setView('meeting');
    } catch (err) {
      setError(err.message);
      socketRef.current?.disconnect();
    } finally { setConnecting(false); }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError('Please enter a room code');
    if (code.length !== 6) return setError('Room code must be 6 characters');
    if (connecting) return;
    setError(''); setConnecting(true);
    try {
      await Promise.all([fetchIceServers(), acquireMic()]);
      const socket = await connectSocket();
      setupSocketListeners(socket);
      const res = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Server did not respond. Try again.')), 8000);
        socket.emit('join-room', { roomCode: code, userId: user?.id, username }, (d) => { clearTimeout(t); resolve(d); });
      });
      if (!res.success) throw new Error(res.error || 'Room not found. Check the code.');
      setRoomCode(code);
      setView('waiting'); // wait for host to admit
    } catch (err) {
      setError(err.message);
      socketRef.current?.disconnect();
      setConnecting(false);
    }
    // NOTE: setConnecting(false) is called in 'admitted'/'denied' listeners, not here
  };

  // Mic is now acquired in handleCreate/handleJoin BEFORE entering the meeting
  // so buildPeerConnection always has audio tracks available.

  // ─── Host admit / deny guests ──────────────────────────────────────────────
  const admitGuest = (guestSocketId) => {
    socketRef.current?.emit('admit-guest', { guestSocketId });
    setKnockQueue(prev => prev.filter(k => k.socketId !== guestSocketId));
  };

  const denyGuest = (guestSocketId) => {
    socketRef.current?.emit('deny-guest', { guestSocketId });
    setKnockQueue(prev => prev.filter(k => k.socketId !== guestSocketId));
  };

  // ─── Screen Share ──────────────────────────────────────────────────────────
  const canScreenShare = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const startScreenShare = async () => {
    if (!canScreenShare) {
      setError('Screen sharing is not supported on this device');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
          cursor: 'always',
        },
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.contentHint = 'detail';

      screenStreamRef.current = stream;
      // Set state first so the <video> element renders, then attach in the callback ref
      setIsScreenSharing(true);
      socketRef.current?.emit('screen-share-started', { roomCode: roomCodeRef.current });

      // Push screen track to all peers + renegotiate
      for (const [peerId, pc] of peerConnsRef.current) {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, stream);
        }
        // Renegotiate so remote side picks up the new track
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal', { to: peerId, signal: offer });
        await setMaxBitrate(pc, 8000);
      }

      // Auto-stop when user clicks browser "Stop sharing" button
      videoTrack.onended = () => stopScreenShare();

    } catch (err) {
      if (err.name !== 'NotAllowedError') setError('Screen share failed: ' + err.message);
    }
  };

  const stopScreenShare = async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    setRemoteCursor(null);
    socketRef.current?.emit('screen-share-stopped', { roomCode: roomCodeRef.current });

    // Revert to camera track if on
    for (const [peerId, pc] of peerConnsRef.current) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      } else if (sender) {
        await sender.replaceTrack(null);
      }
    }
  };

  // ─── Mic / Camera ──────────────────────────────────────────────────────────
  const toggleMic = async () => {
    try {
      if (!localStreamRef.current?.getAudioTracks().length) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 } });
        const audioTrack = stream.getAudioTracks()[0];
        if (!localStreamRef.current) localStreamRef.current = stream;
        else localStreamRef.current.addTrack(audioTrack);
        for (const [peerId, pc] of peerConnsRef.current) {
          // Use replaceTrack if an audio sender exists, else addTrack
          const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (audioSender) {
            await audioSender.replaceTrack(audioTrack);
          } else {
            pc.addTrack(audioTrack, localStreamRef.current);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('signal', { to: peerId, signal: offer });
          }
        }
        setIsMuted(false);
      } else {
        const track = localStreamRef.current.getAudioTracks()[0];
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    } catch { setError('Microphone access denied'); }
  };

  const toggleCamera = async () => {
    try {
      if (!isVideoOn) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: 30 } });
        const videoTrack = stream.getVideoTracks()[0];
        if (!localStreamRef.current) localStreamRef.current = stream;
        else localStreamRef.current.addTrack(videoTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        for (const [peerId, pc] of peerConnsRef.current) {
          if (!isScreenSharing) {
            // Use replaceTrack if a video sender exists, else addTrack
            const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, localStreamRef.current);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current?.emit('signal', { to: peerId, signal: offer });
            }
          }
        }
        setIsVideoOn(true);
      } else {
        localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
        // Notify peers to remove video — replace with null
        for (const [, pc] of peerConnsRef.current) {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender && !isScreenSharing) {
            await videoSender.replaceTrack(null);
          }
        }
        setIsVideoOn(false);
      }
    } catch { setError('Camera access denied'); }
  };

  // ─── Remote Control ────────────────────────────────────────────────────────
  const handleRemoteVideoMouseMove = useCallback((e) => {
    if (!remoteControlActive) return;
    const video = remoteScreenRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const msg = JSON.stringify({ type: 'control-event', action: 'mousemove', x, y });
    dataChannelsRef.current.forEach(dc => { if (dc.readyState === 'open') dc.send(msg); });
  }, [remoteControlActive]);

  const handleRemoteVideoClick = useCallback((e) => {
    if (!remoteControlActive) return;
    const video = remoteScreenRef.current;
    if (!video) return;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const msg = JSON.stringify({ type: 'control-event', action: 'click', button: e.button, x, y });
    dataChannelsRef.current.forEach(dc => { if (dc.readyState === 'open') dc.send(msg); });
  }, [remoteControlActive]);

  const handleRemoteVideoKeyDown = useCallback((e) => {
    if (!remoteControlActive) return;
    e.preventDefault();
    const msg = JSON.stringify({ type: 'control-event', action: 'keydown', key: e.key, code: e.code });
    dataChannelsRef.current.forEach(dc => { if (dc.readyState === 'open') dc.send(msg); });
  }, [remoteControlActive]);

  const handleControlResponse = (granted) => {
    if (!controlRequest) return;
    socketRef.current?.emit(granted ? 'grant-control' : 'deny-control', { to: controlRequest.from });
    setControlRequest(null);
  };

  // ─── Misc ──────────────────────────────────────────────────────────────────
  const sendChat = (msg) => socketRef.current?.emit('meeting-chat', { roomCode: roomCodeRef.current, message: msg, username });

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const leaveMeeting = () => {
    clearInterval(statsTimerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnsRef.current.forEach((pc, peerId) => {
      pc.close();
      document.getElementById(`remote-audio-${peerId}`)?.remove();
    });
    peerConnsRef.current.clear();
    dataChannelsRef.current.clear();
    remoteVideosRef.current.clear();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setView('lobby'); setRoomCode(''); setPeers([]);
    setChatMessages([]); setIsScreenSharing(false); setRemoteScreenStream(null);
    setIsMuted(true); setIsVideoOn(false);
    setShowChat(false); setShowAnnotations(false);
    setRemoteControlActive(false); setRemoteCursor(null);
    setNetworkStats(null); setError('');
    setIsHost(false); setKnockQueue([]);
  };

  useEffect(() => () => {
    clearInterval(statsTimerRef.current);
    clearInterval(sessionTimerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnsRef.current.forEach(pc => pc.close());
    socketRef.current?.disconnect();
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // WAITING ROOM (guest waiting for host approval)
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'waiting') {
    return (
      <div className="meeting-page">
        <div className="meeting-lobby">
          <div className="lobby-icon waiting-pulse">⏳</div>
          <h2>Waiting to Join</h2>
          <p className="lobby-subtitle">The host has been notified. Please wait...</p>
          <div className="waiting-room-code">Room: <strong>{roomCode}</strong></div>
          {error && (
            <div className="meeting-error">
              <span>⚠️ {error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}
          <button className="meeting-leave-btn-sm" onClick={() => {
            socketRef.current?.disconnect();
            setView('lobby'); setRoomCode(''); setConnecting(false); setError('');
          }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOBBY
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'lobby') {
    return (
      <div className="meeting-page">
        <div className="meeting-lobby">
          <div className="lobby-icon">📹</div>
          <h2>Meetings</h2>
          <p className="lobby-subtitle">Screen sharing · Remote control · Annotations</p>

          {error && (
            <div className="meeting-error">
              <span>⚠️ {error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}

          <button className="meeting-create-btn" onClick={handleCreate} disabled={connecting}>
            {connecting
              ? <span className="btn-spinner">◌ Connecting...</span>
              : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Start New Meeting</>
            }
          </button>

          <div className="lobby-divider"><span>or join with code</span></div>

          <div className="lobby-join">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="ABC123"
              maxLength={6}
              className="join-code-input"
              disabled={connecting}
            />
            <button className="meeting-join-btn" onClick={handleJoin} disabled={connecting || !joinCode.trim()}>
              {connecting ? '...' : 'Join'}
            </button>
          </div>
          <p className="lobby-hint">6-character code from the meeting host</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MEETING ROOM
  // ════════════════════════════════════════════════════════════════════════════
  const hasRemoteScreen = peers.some(p => p.isScreenSharing);

  return (
    <div className="meeting-page meeting-active" ref={containerRef}>

      {/* Knock queue — host admits/denies guests */}
      {isHost && knockQueue.length > 0 && (
        <div className="knock-queue">
          {knockQueue.map(k => (
            <div key={k.socketId} className="knock-item">
              <div className="knock-avatar">{k.username?.[0]?.toUpperCase() || '?'}</div>
              <span className="knock-name"><strong>{k.username}</strong> wants to join</span>
              <div className="knock-actions">
                <button className="admit-btn" onClick={() => admitGuest(k.socketId)}>Admit</button>
                <button className="deny-btn" onClick={() => denyGuest(k.socketId)}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remote control request modal */}
      {controlRequest && (
        <div className="control-modal">
          <p><strong>{controlRequest.username}</strong> is requesting remote control</p>
          <div className="control-actions">
            <button className="grant-btn" onClick={() => handleControlResponse(true)}>Allow</button>
            <button className="deny-btn" onClick={() => handleControlResponse(false)}>Deny</button>
          </div>
        </div>
      )}

      {/* Error/info banner */}
      {error && (
        <div className="meeting-error-banner">
          ⚠️ {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Top bar */}
      <div className="meeting-topbar">
        <div className="room-info">
          <span className="room-label">Room</span>
          <span className="room-code-text">{roomCode}</span>
          <button className="copy-btn" onClick={copyCode}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
        <div className="session-stats">
          <span className="session-time">{fmtTime(sessionTime)}</span>
          {networkStats && (
            <span className="net-stats">{networkStats.fps}fps · {Math.round(networkStats.bitrate / 1000)}Mbps</span>
          )}
        </div>
        <div className="participant-count">👥 {peers.length + 1}</div>
      </div>

      {/* Main area */}
      <div className="meeting-content">
        <div className="meeting-main">

          {/* My screen share */}
          {isScreenSharing && (
            <div className="screen-container" onMouseMove={sendCursorPosition}>
              <video ref={el => {
                screenVideoRef.current = el;
                if (el && screenStreamRef.current) {
                  el.srcObject = screenStreamRef.current;
                  el.play().catch(() => {});
                }
              }} autoPlay playsInline muted className="screen-video" />
              {remoteCursor && (
                <div className="remote-cursor-dot" style={{ left: `${remoteCursor.x * 100}%`, top: `${remoteCursor.y * 100}%` }} />
              )}
              {showAnnotations && (
                <AnnotationCanvas socket={socketRef.current} roomCode={roomCode} />
              )}
              <div className="screen-share-badge">🔴 Sharing your screen</div>
            </div>
          )}

          {/* Remote screen share — with remote control overlay */}
          {!isScreenSharing && hasRemoteScreen && (
            <div className="screen-container">
              <video
                ref={el => {
                  remoteScreenRef.current = el;
                  if (el) {
                    // Attach the screen stream — try React state first, then ref map
                    const stream = remoteScreenStream
                      || (() => { const p = peers.find(p => p.isScreenSharing); return p && remoteVideosRef.current.get(p.socketId); })();
                    if (stream && el.srcObject !== stream) {
                      console.log('📺 Attaching screen stream via callback ref');
                      el.srcObject = stream;
                    }
                    // Always kick play — needed for autoplay policy on some browsers
                    if (el.srcObject) el.play().catch(() => {});
                  }
                }}
                autoPlay playsInline muted
                className={`screen-video ${remoteControlActive ? 'remote-control-active' : ''}`}
                onMouseMove={handleRemoteVideoMouseMove}
                onClick={handleRemoteVideoClick}
                onKeyDown={handleRemoteVideoKeyDown}
                tabIndex={remoteControlActive ? 0 : -1}
              />
              {showAnnotations && (
                <AnnotationCanvas socket={socketRef.current} roomCode={roomCode} />
              )}
              {remoteControlActive && (
                <div className="remote-control-badge">🖱️ Remote Control Active</div>
              )}
            </div>
          )}

          {/* Participant grid (no screen share) */}
          {!isScreenSharing && !hasRemoteScreen && (
            <div className="participants-grid">
              {peers.map(p => {
                const stream = remoteVideosRef.current.get(p.socketId);
                return (
                  <div key={p.socketId} className="peer-tile">
                    {stream ? (
                      <video autoPlay playsInline
                        ref={el => { if (el && stream) el.srcObject = stream; }}
                        className="peer-video" />
                    ) : (
                      <div className="peer-avatar">{p.username?.[0]?.toUpperCase() || '?'}</div>
                    )}
                    <div className="peer-name">{p.username}</div>
                    {p.isScreenSharing && <div className="peer-badge">Sharing</div>}
                  </div>
                );
              })}
              <div className="peer-tile self">
                {isVideoOn
                  ? <video ref={localVideoRef} autoPlay playsInline muted className="peer-video" />
                  : <div className="peer-avatar self-av">{username?.[0]?.toUpperCase() || 'Y'}</div>
                }
                <div className="peer-name">You {isMuted && '🔇'}</div>
              </div>
              {peers.length === 0 && (
                <div className="waiting-state">
                  <p>Waiting for others to join...</p>
                  <div className="big-code">{roomCode}</div>
                  <p className="code-hint">Share this code</p>
                </div>
              )}
            </div>
          )}
        </div>

        {showChat && (
          <MeetingChat messages={chatMessages} onSend={sendChat} username={username} onClose={() => setShowChat(false)} />
        )}
      </div>

      {/* Controls bar */}
      <div className="meeting-controls">
        <button className={`ctrl ${isMuted ? 'off' : ''}`} onClick={toggleMic}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isMuted
              ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
              : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
            }
          </svg>
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button className={`ctrl ${isVideoOn ? '' : 'off'}`} onClick={toggleCamera}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isVideoOn
              ? <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
              : <><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34"/><line x1="1" y1="1" x2="23" y2="23"/></>
            }
          </svg>
          <span>Camera</span>
        </button>

        <button className={`ctrl ${isScreenSharing ? 'active' : ''} ${!canScreenShare ? 'disabled' : ''}`}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          disabled={!canScreenShare && !isScreenSharing}
          title={!canScreenShare ? 'Screen sharing not supported on mobile' : ''}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>{!canScreenShare ? 'No Share' : isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        <button
          className={`ctrl ${remoteControlActive ? 'active' : ''}`}
          onClick={() => {
            if (hasRemoteScreen && !isScreenSharing) {
              if (!remoteControlActive) {
                // Request control from the screen sharer
                const sharer = peers.find(p => p.isScreenSharing);
                if (sharer) socketRef.current?.emit('request-control', { roomCode, to: sharer.socketId });
              } else {
                setRemoteControlActive(false);
              }
            } else {
              setError('No remote screen to control. Ask someone to share their screen first.');
            }
          }}
          title="Request remote control of shared screen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
          </svg>
          <span>{remoteControlActive ? 'Release' : 'Control'}</span>
        </button>

        <button className={`ctrl ${showAnnotations ? 'active' : ''}`}
          onClick={() => setShowAnnotations(s => !s)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          </svg>
          <span>Draw</span>
        </button>

        <button className={`ctrl ${showChat ? 'active' : ''}`} onClick={() => setShowChat(s => !s)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>Chat{chatMessages.length > 0 && !showChat ? ` (${chatMessages.length})` : ''}</span>
        </button>

        <button className="ctrl" onClick={toggleFullscreen}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          <span>Fullscreen</span>
        </button>

        <button className="ctrl end" onClick={leaveMeeting}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004 .64 2 2 0 012 2v3a2 2 0 01-2.18 2A19.79 19.79 0 013.18 2.18 2 2 0 015.18.18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.91 8.09a16 16 0 001.77 5.22z"/>
          </svg>
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}
