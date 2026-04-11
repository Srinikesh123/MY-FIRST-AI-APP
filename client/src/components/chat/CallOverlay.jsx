import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../ui/Toast';
import './CallOverlay.css';

let ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

async function loadIceServers() {
  try {
    const res = await fetch('/api/turn-credentials');
    const { iceServers } = await res.json();
    if (iceServers?.length) ICE_SERVERS = iceServers;
  } catch (_) {}
}

export default function CallOverlay({ supabase, userId, chatId, chatName, onEnd }) {
  const [status, setStatus] = useState('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const { error: showError } = useToast();

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // Timer when active
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [supabase]);

  const endCall = useCallback((notify = true) => {
    if (!mountedRef.current) return;
    mountedRef.current = false;

    if (notify && channelRef.current) {
      // Send end signal, then wait for it to actually transmit before cleanup
      channelRef.current.send({
        type: 'broadcast', event: 'signal',
        payload: { from: userId, type: 'end-call' },
      });
      setTimeout(() => {
        cleanup();
        onEndRef.current();
      }, 300);
    } else {
      cleanup();
      onEndRef.current();
    }
  }, [cleanup, userId]);

  useEffect(() => {
    mountedRef.current = true;

    const setup = async () => {
      try {
        await loadIceServers();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // When remote audio arrives — play it
        pc.ontrack = (e) => {
          if (!mountedRef.current) return;
          const remoteStream = e.streams[0];
          if (remoteStream && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
          }
          setStatus('active');
        };

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          if (state === 'connected') setStatus('active');
          if (state === 'disconnected' || state === 'failed') endCall(false);
        };

        // Supabase realtime channel for signaling
        const channel = supabase.channel(`call-${chatId}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        // Handle incoming signals
        channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
          if (!payload || payload.from === userId || !mountedRef.current) return;
          const currentPc = pcRef.current;
          if (!currentPc) return;

          try {
            if (payload.type === 'offer') {
              await currentPc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await currentPc.createAnswer();
              await currentPc.setLocalDescription(answer);
              channel.send({
                type: 'broadcast', event: 'signal',
                payload: { from: userId, type: 'answer', sdp: answer },
              });
            } else if (payload.type === 'answer') {
              await currentPc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } else if (payload.type === 'ice-candidate' && payload.candidate) {
              await currentPc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else if (payload.type === 'end-call') {
              endCall(false);
            }
          } catch (err) {
            console.error('Signal error:', err);
          }
        });

        pc.onicecandidate = (e) => {
          if (e.candidate && channelRef.current) {
            channelRef.current.send({
              type: 'broadcast', event: 'signal',
              payload: { from: userId, type: 'ice-candidate', candidate: e.candidate },
            });
          }
        };

        await channel.subscribe();

        // Send offer
        setStatus('ringing');
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast', event: 'signal',
          payload: { from: userId, type: 'offer', sdp: offer },
        });

        // Timeout — 30 seconds
        setTimeout(() => {
          if (mountedRef.current && pcRef.current?.iceConnectionState !== 'connected') {
            endCall(false);
          }
        }, 30000);

      } catch (err) {
        console.error('Call setup error:', err);
        if (mountedRef.current) {
          showError('Could not access microphone. Please allow permissions.');
          onEndRef.current();
        }
      }
    };

    setup();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };

  return (
    <div className="call-overlay">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="call-container">
        <div className="call-avatar">{chatName?.[0]?.toUpperCase() || '?'}</div>
        <div className="call-name">{chatName}</div>
        {status === 'active' && <div className="call-timer">{fmt(duration)}</div>}
        {status === 'ringing' && <div className="call-ringing">Calling...</div>}
        {status === 'connecting' && <div className="call-ringing">Connecting...</div>}

        <div className="call-controls">
          <button className={`call-btn ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMuted
                ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                : <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
              }
            </svg>
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button className="call-btn end-call" onClick={() => endCall(true)} title="End Call">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004 .64 2 2 0 012 2v3a2 2 0 01-2.18 2A19.79 19.79 0 013.18 2.18 2 2 0 015.18.18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.91 8.09a16 16 0 001.77 5.22z"/>
            </svg>
            <span>End</span>
          </button>
        </div>
      </div>
    </div>
  );
}
