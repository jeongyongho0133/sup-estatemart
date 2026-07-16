import React, { useRef, useState, useEffect } from 'react';

const SignaturePad = ({ isOpen, onClose, onSave, title = '전자 서명' }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        // Reset canvas resolution based on display size and device pixel ratio
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.strokeStyle = '#1e293b'; // slate-800
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        setIsEmpty(true);
    }, [isOpen]);

    if (!isOpen) return null;

    // Helper: Get coordinate relative to canvas bounding box
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        
        // Check for touch event
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        
        // Mouse event
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        // Prevent default scrolling for touch devices
        if (e.cancelable) e.preventDefault();
        
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setIsEmpty(false);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();

        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.closePath();
            setIsDrawing(false);
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const handleSave = () => {
        if (isEmpty) {
            alert('서명을 입력해 주세요.');
            return;
        }
        const canvas = canvasRef.current;
        // Export to Base64 image URL (PNG)
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-base">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg font-medium p-1"
                    >
                        ✕
                    </button>
                </div>

                {/* Canvas Area */}
                <div className="p-5">
                    <p className="text-xs text-gray-500 mb-3 text-center">
                        아래 흰색 영역에 마우스나 손가락(터치)으로 서명을 그려주세요.
                    </p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 h-52 relative">
                        <canvas
                            ref={canvasRef}
                            className="w-full h-full bg-white touch-none cursor-crosshair"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex space-x-2">
                    <button
                        onClick={handleClear}
                        className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-sm transition"
                    >
                        다시 그리기
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3 bg-market-orange hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-md transition"
                    >
                        서명 완료
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignaturePad;
