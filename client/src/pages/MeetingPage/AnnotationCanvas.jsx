import { useRef, useState, useEffect, useCallback } from 'react';
import './AnnotationCanvas.css';

const TOOLS = [
  { id: 'pen', label: 'Draw', icon: '✏️' },
  { id: 'highlighter', label: 'Highlight', icon: '🖍️' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'eraser', label: 'Eraser', icon: '🧹' },
];

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];

export default function AnnotationCanvas({ socket, roomCode }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState(null);
  const lastPoint = useRef(null);

  // Resize canvas to match parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Listen for remote annotations
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => drawFromData(data);
    const clearHandler = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    socket.on('annotation', handler);
    socket.on('clear-annotations', clearHandler);
    return () => {
      socket.off('annotation', handler);
      socket.off('clear-annotations', clearHandler);
    };
  }, [socket]);

  const drawFromData = useCallback((data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (data.type === 'line') {
      ctx.beginPath();
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (data.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = data.lineWidth * 4;
      }
      ctx.moveTo(data.from.x * canvas.width, data.from.y * canvas.height);
      ctx.lineTo(data.to.x * canvas.width, data.to.y * canvas.height);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (data.type === 'text') {
      ctx.font = `${16}px sans-serif`;
      ctx.fillStyle = data.color;
      ctx.fillText(data.text, data.pos.x * canvas.width, data.pos.y * canvas.height);
    }
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const handleStart = (e) => {
    if (tool === 'text') {
      const pos = getPos(e);
      setTextPos(pos);
      return;
    }
    setIsDrawing(true);
    lastPoint.current = getPos(e);
  };

  const handleMove = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);

    if (tool === 'eraser') {
      ctx.clearRect(
        pos.x * canvas.width - 15,
        pos.y * canvas.height - 15,
        30, 30
      );
    } else {
      const data = {
        type: 'line',
        tool,
        color,
        lineWidth,
        from: lastPoint.current,
        to: pos,
      };
      drawFromData(data);
      socket?.emit('annotation', { roomCode, data });
    }

    lastPoint.current = pos;
  };

  const handleEnd = () => {
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPos) return;
    const data = { type: 'text', color, text: textInput, pos: textPos };
    drawFromData(data);
    socket?.emit('annotation', { roomCode, data });
    setTextInput('');
    setTextPos(null);
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    socket?.emit('clear-annotations', { roomCode });
  };

  return (
    <div className="annotation-layer">
      <canvas
        ref={canvasRef}
        className="annotation-canvas"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Text input popup */}
      {textPos && (
        <div className="text-input-popup" style={{ left: `${textPos.x * 100}%`, top: `${textPos.y * 100}%` }}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            placeholder="Type here..."
            autoFocus
          />
          <button onClick={handleTextSubmit}>Add</button>
          <button onClick={() => setTextPos(null)}>Cancel</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="annotation-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`anno-tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
        <div className="anno-divider" />
        {COLORS.map(c => (
          <button
            key={c}
            className={`anno-color-btn ${color === c ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
        <div className="anno-divider" />
        <button className="anno-tool-btn" onClick={clearAll} title="Clear All">🗑️</button>
      </div>
    </div>
  );
}
