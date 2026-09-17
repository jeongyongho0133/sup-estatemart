import React, { useRef, useState, useEffect, useCallback } from 'react';

const INK_COLORS = [
    { label: '블랙', value: '#0f172a', bgClass: 'bg-slate-900' },
    { label: '로열블루', value: '#1d4ed8', bgClass: 'bg-blue-700' },
    { label: '인주레드', value: '#b91c1c', bgClass: 'bg-red-700' },
];

const PEN_WIDTHS = [
    { label: '보통', value: 2.8 },
    { label: '굵게', value: 4.5 },
];

const SignaturePad = ({ isOpen, onClose, onSave, title = '전자 서명', subtitle = '' }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // 획(Strokes) 히스토리 스택: { color, width, points: [{x, y}] }
    const [strokes, setStrokes] = useState([]);
    const currentStrokeRef = useRef(null);
    const isDrawingRef = useRef(false);

    // 스타일 옵션 상태
    const [selectedColor, setSelectedColor] = useState(INK_COLORS[0].value);
    const [selectedWidth, setSelectedWidth] = useState(PEN_WIDTHS[0].value);

    // 캔버스 크기 및 스케일 재계산
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    // 획 목록 전체 재렌더링 (곡선 스무딩 적용)
    const redrawAll = useCallback((strokeList, current = null) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        const listToDraw = current ? [...strokeList, current] : strokeList;

        listToDraw.forEach(stroke => {
            const { points, color, width } = stroke;
            if (!points || points.length === 0) return;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (points.length === 1) {
                // 단일 탭 점 찍기
                ctx.beginPath();
                ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            if (points.length === 2) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                ctx.lineTo(points[1].x, points[1].y);
                ctx.stroke();
                return;
            }

            // 3개 이상의 점: 2차 베지에 곡선(Quadratic Bézier Curve) 중간점 보간
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length - 1; i++) {
                const midX = (points[i].x + points[i + 1].x) / 2;
                const midY = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
            }

            const lastPoint = points[points.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
            ctx.stroke();
        });
    }, []);

    // 모달 오픈 시 캔버스 초기화
    useEffect(() => {
        if (!isOpen) return;

        setStrokes([]);
        currentStrokeRef.current = null;
        isDrawingRef.current = false;

        const timer = setTimeout(() => {
            setupCanvas();
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const rect = canvas.getBoundingClientRect();
                ctx.clearRect(0, 0, rect.width, rect.height);
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [isOpen, setupCanvas]);

    // 획 목록 변경 시 다시 그리기
    useEffect(() => {
        if (!isOpen) return;
        redrawAll(strokes, currentStrokeRef.current);
    }, [strokes, isOpen, redrawAll]);

    // 상대 좌표 추출 헬퍼
    const getCoordinates = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }, []);

    // 드로잉 시작
    const handleStart = useCallback((e) => {
        if (e.cancelable) e.preventDefault();
        const coords = getCoordinates(e);

        isDrawingRef.current = true;
        currentStrokeRef.current = {
            color: selectedColor,
            width: selectedWidth,
            points: [coords]
        };

        redrawAll(strokes, currentStrokeRef.current);
    }, [getCoordinates, selectedColor, selectedWidth, strokes, redrawAll]);

    // 드로잉 진행
    const handleMove = useCallback((e) => {
        if (!isDrawingRef.current || !currentStrokeRef.current) return;
        if (e.cancelable) e.preventDefault();

        const coords = getCoordinates(e);
        const points = currentStrokeRef.current.points;

        // 너무 잦은 중복 포인트 필터링 (부드러움 및 성능 최적화)
        const lastPt = points[points.length - 1];
        const dist = Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y);
        if (dist >= 1.5) {
            points.push(coords);
            redrawAll(strokes, currentStrokeRef.current);
        }
    }, [getCoordinates, strokes, redrawAll]);

    // 드로잉 종료
    const handleEnd = useCallback((e) => {
        if (!isDrawingRef.current) return;
        if (e && e.cancelable) e.preventDefault();

        isDrawingRef.current = false;
        if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
            setStrokes(prev => [...prev, currentStrokeRef.current]);
        }
        currentStrokeRef.current = null;
    }, []);

    // 모바일 터치 이벤트 리스너 (passive: false 로 터치 스크롤 완전 격리)
    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onTouchStart = (e) => handleStart(e);
        const onTouchMove = (e) => handleMove(e);
        const onTouchEnd = (e) => handleEnd(e);

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [isOpen, handleStart, handleMove, handleEnd]);

    // 1획 취소 (Undo)
    const handleUndo = () => {
        if (strokes.length === 0) return;
        setStrokes(prev => prev.slice(0, -1));
    };

    // 전체 지우기 (Clear)
    const handleClear = () => {
        setStrokes([]);
        currentStrokeRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
        }
    };

    // 서명 저장
    const handleSave = () => {
        if (strokes.length === 0) {
            alert('서명을 작성해 주세요.');
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        // 투명 PNG 형태로 서명 이미지 내보내기
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center sm:items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                ref={containerRef}
                className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
            >
                {/* 헤더 영역 */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
                    <div>
                        <div className="flex items-center space-x-1.5">
                            <span className="text-base">✍️</span>
                            <h3 className="font-extrabold text-gray-900 text-sm">{title}</h3>
                        </div>
                        {subtitle && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200/70 text-gray-400 hover:text-gray-700 transition"
                        title="닫기"
                    >
                        ✕
                    </button>
                </div>

                {/* 툴바: 잉크 색상 및 펜 굵기 선택 */}
                <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-gray-400 font-bold">잉크</span>
                        <div className="flex space-x-1.5 items-center">
                            {INK_COLORS.map(color => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setSelectedColor(color.value)}
                                    className={`w-6 h-6 rounded-full ${color.bgClass} flex items-center justify-center transition ${selectedColor === color.value ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                    title={color.label}
                                >
                                    {selectedColor === color.value && (
                                        <span className="text-white text-[9px] font-black">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-gray-400 font-bold">굵기</span>
                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            {PEN_WIDTHS.map(pw => (
                                <button
                                    key={pw.label}
                                    type="button"
                                    onClick={() => setSelectedWidth(pw.value)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition ${selectedWidth === pw.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {pw.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 캔버스 드로잉 영역 */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    <div className="relative w-full h-56 sm:h-64 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden bg-slate-50/50 shadow-inner flex items-center justify-center select-none">
                        
                        {/* 서명 가이드 배경 레이어 (이미지 저장 시 포함되지 않음) */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 opacity-40">
                            <div className="flex justify-between items-center text-[11px] text-gray-400 font-medium">
                                <span>정자로 서명 또는 날인해주세요</span>
                                <span className="border border-gray-300 rounded px-1.5 py-0.5 text-[9px]">(인/서명)</span>
                            </div>
                            <div className="w-full border-b border-dashed border-indigo-200 mb-6 flex justify-between text-[10px] text-indigo-300 px-1 font-semibold">
                                <span>서명 기준선 ──────</span>
                                <span>Sign Here ✍️</span>
                            </div>
                        </div>

                        {/* 실제 드로잉 캔버스 (투명 배경) */}
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full touch-none cursor-crosshair z-10"
                            onMouseDown={handleStart}
                            onMouseMove={handleMove}
                            onMouseUp={handleEnd}
                            onMouseLeave={handleEnd}
                        />
                    </div>

                    {/* 실시간 피드백 및 안내 문구 */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 px-1">
                        <span>모바일 터치 또는 펜으로 서명하세요.</span>
                        {strokes.length > 0 && (
                            <span className="text-indigo-600 font-bold">
                                {strokes.length}개 획 작성됨
                            </span>
                        )}
                    </div>
                </div>

                {/* 하단 버튼 그룹 (Undo, Clear, Submit) */}
                <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={handleUndo}
                        disabled={strokes.length === 0}
                        className={`px-3.5 py-3 rounded-xl text-xs font-bold border transition flex items-center space-x-1 ${strokes.length === 0 ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95'}`}
                        title="직전 1개 획 취소"
                    >
                        <span>↩</span>
                        <span>한 획 취소</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={strokes.length === 0}
                        className={`px-3.5 py-3 rounded-xl text-xs font-bold border transition ${strokes.length === 0 ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95'}`}
                    >
                        다시 그리기
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 py-3 bg-market-orange hover:bg-orange-600 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition active:scale-95 flex items-center justify-center space-x-1"
                    >
                        <span>서명 완료</span>
                        <span>✓</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignaturePad;
