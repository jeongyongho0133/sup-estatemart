import React, { useState, useRef, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const AiChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: '안녕하세요! EstateMartet AI 상담사입니다. 무엇을 도와드릴까요?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const functions = getFunctions();
            const estateConsultant = httpsCallable(functions, 'estateConsultant');

            // Context could be enhanced with current page info if needed
            const result = await estateConsultant({
                message: userMessage,
                context: {
                    history: messages.slice(-5) // Send last 5 messages for context
                }
            });

            if (result.data && result.data.response) {
                setMessages(prev => [...prev, { role: 'assistant', text: result.data.response }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', text: "죄송합니다. 답변을 생성하지 못했습니다." }]);
            }
        } catch (error) {
            console.error("AI Chat Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 right-4 w-16 h-16 bg-market-orange text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50 group"
            >
                <div className="absolute inset-0 w-full h-full animate-spin-slow">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <path
                            id="circlePath"
                            d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
                            fill="transparent"
                        />
                        <text className="text-[11px] font-black fill-white/90">
                            <textPath xlinkHref="#circlePath" startOffset="0%">
                                AI 상담사 • AI 상담사 • 
                            </textPath>
                        </text>
                    </svg>
                </div>
                <span className="text-2xl relative z-10 group-hover:scale-110 transition-transform">🤖</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-20 right-4 w-80 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-100 font-sans">
            {/* Header */}
            <div className="bg-market-orange p-4 flex justify-between items-center text-white">
                <div className="flex items-center space-x-2">
                    <span className="text-xl">🤖</span>
                    <span className="font-bold text-sm">AI 부동산 상담사</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-white hover:bg-white/20 rounded-full p-1">
                    ✕
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-market-orange text-white rounded-tr-none'
                                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-gray-100">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="부동산 관련 궁금한 점을 물어보세요!"
                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-full text-xs outline-none focus:border-market-orange"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition ${isLoading || !input.trim() ? 'bg-gray-200 text-gray-400' : 'bg-market-orange text-white hover:bg-orange-600'
                            }`}
                    >
                        ➤
                    </button>
                </div>
                <div className="text-[10px] text-gray-400 text-center mt-2">
                    AI 답변은 부정확할 수 있으니 참고용으로만 사용해주세요.
                </div>
            </div>
        </div>
    );
};

export default AiChat;
