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

async function fetchIceServers() {
  try {
    const res = await fetch('/api/turn-credentials');
    const { iceServers } = await res.json();
    if (iceServers?.length) {
      ICE_SERVERS = iceServers;
      const turnCount = iceServers.filter(s => s.urls?.toString().includes('turn')).length;
      console.log(`✅ ICE servers: ${iceServers.length} total, ${turnCount} TURN`);
    }
  } catch (err) {
    console.warn('TURN fetch failed, using STUN only:', err.message);
  }
}

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
      console.log(`ICE [${peerId}]: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        // Try ICE restart
        pc.restartIce();
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      remoteVideosRef.current.set(peerId, stream);
      // If it's a screen share (video track, high res) show in main area
      if (e.track.kind === 'video') {
        if (remoteScreenRef.current) remoteScreenRef.current.srcObject = stream;
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
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
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
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { to: from, signal: answer });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
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
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
    });

    socket.on('meeting-chat', (msg) => setChatMessages(prev => [...prev, msg]));
    socket.on('chat-history', (h) => setChatMessages(h));
    socket.on('peer-screen-sharing', ({ socketId, sharing }) =>
      setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, isScreenSharing: sharing } : p)));
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
      if (reason !== 'io client disconnect') setError('Disconnected. Reconnecting...');
    });
  }, [buildPeerConnection]);

  const offerToPeer = useCallback(async (peerId) => {
    const socket = socketRef.current;
    if (!socket) return;
    let pc = peerConnsRef.current.get(peerId);
    if (!pc) {
      pc = buildPeerConnection(peerId, socket, true);
      peerConnsRef.current.set(peerId, pc);
    }
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
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

  // ─── Create / Join ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (connecting) return;
    setError(''); setConnecting(true);
    try {
      await fetchIceServers();
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
      await fetchIceServers();
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

  // ─── Auto-start mic when entering meeting ─────────────────────────────────
  useEffect(() => {
    if (view !== 'meeting') return;
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        setIsMuted(false);
        // Add audio track to any existing peer connections
        for (const [peerId, pc] of peerConnsRef.current) {
          stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('signal', { to: peerId, signal: offer });
        }
      } catch (_) {
        // Mic denied — fine, user can click manually
      }
    })();
    return () => { active = false; };
  }, [view]);

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
  const startScreenShare = async () => {
    try {
      // Maximum quality — 1080p 30fps, system audio optional
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 30, max: 60 },
          cursor: 'always',
          displaySurface: 'monitor', // prefer full monitor
          logicalSurface: true,
          contentHint: 'detail', // optimize for text/UI sharpness
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
        selfBrowser: false,
      });

      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }
      setIsScreenSharing(true);
      socketRef.current?.emit('screen-share-started', { roomCode: roomCodeRef.current });

      // Push screen track to all peers + renegotiate
      for (const [peerId, pc] of peerConnsRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        // contentHint for sharpness (text/UI mode)
        videoTrack.contentHint = 'detail';

        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
          await setMaxBitrate(pc, 8000);
        } else {
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('signal', { to: peerId, signal: offer });
          await setMaxBitrate(pc, 8000);
        }
      }

      // Auto-stop when user clicks "Stop sharing" in browser UI
      stream.getVideoTracks()[0].onended = () => stopScreenShare();

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
        if (!localStreamRef.current) localStreamRef.current = stream;
        else stream.getAudioTracks().forEach(t => localStreamRef.current.addTrack(t));
        for (const [peerId, pc] of peerConnsRef.current) {
          stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('signal', { to: peerId, signal: offer });
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
        if (!localStreamRef.current) localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        for (const [peerId, pc] of peerConnsRef.current) {
          if (!isScreenSharing) {
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('signal', { to: peerId, signal: offer });
          }
        }
        setIsVideoOn(true);
      } else {
        localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
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
    peerConnsRef.current.forEach(pc => pc.close());
    peerConnsRef.current.clear();
    dataChannelsRef.current.clear();
    remoteVideosRef.current.clear();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setView('lobby'); setRoomCode(''); setPeers([]);
    setChatMessages([]); setIsScreenSharing(false);
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
              <video ref={screenVideoRef} autoPlay playsInline muted className="screen-video" />
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
                ref={remoteScreenRef}
                autoPlay playsInline
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

        <button className={`ctrl ${isScreenSharing ? 'active' : ''}`}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
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
