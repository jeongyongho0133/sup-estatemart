import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const DiagnosticTest = () => {
    const { currentUser } = useAuth();
    const [logs, setLogs] = useState([]);
    const [testStatus, setTestStatus] = useState('idle');

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, message, type }]);
        console.log(`[${type.toUpperCase()}] ${message}`);
    };

    const runDiagnostics = async () => {
        setLogs([]);
        setTestStatus('running');

        try {
            // Test 1: Check authentication
            addLog('=== Test 1: Authentication ===', 'info');
            if (currentUser) {
                addLog(`✅ User logged in: ${currentUser.email || currentUser.uid}`, 'success');
            } else {
                addLog('❌ No user logged in', 'error');
                setTestStatus('failed');
                return;
            }

            // Test 2: Try to read from Firestore
            addLog('=== Test 2: Firestore Read Test ===', 'info');
            try {
                const querySnapshot = await getDocs(collection(db, "listings"));
                addLog(`✅ Successfully read ${querySnapshot.size} documents from listings collection`, 'success');
            } catch (error) {
                addLog(`❌ Read failed: ${error.code} - ${error.message}`, 'error');
            }

            // Test 3: Try to write to Firestore
            addLog('=== Test 3: Firestore Write Test ===', 'info');
            try {
                const testDoc = await addDoc(collection(db, "diagnostic_test"), {
                    timestamp: new Date(),
                    userId: currentUser.uid,
                    message: "Test document"
                });
                addLog(`✅ Successfully wrote document: ${testDoc.id}`, 'success');
            } catch (error) {
                addLog(`❌ Write failed: ${error.code} - ${error.message}`, 'error');
            }

            // Test 4: Network connectivity
            addLog('=== Test 4: Network Connectivity ===', 'info');
            try {
                const response = await fetch('https://firestore.googleapis.com');
                addLog(`✅ Can reach firestore.googleapis.com (Status: ${response.status})`, 'success');
            } catch (error) {
                addLog(`❌ Cannot reach firestore.googleapis.com: ${error.message}`, 'error');
            }

            setTestStatus('completed');
            addLog('=== Diagnostics Complete ===', 'info');
        } catch (error) {
            addLog(`❌ Unexpected error: ${error.message}`, 'error');
            setTestStatus('failed');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Firestore 연결 진단 도구</h1>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <button
                        onClick={runDiagnostics}
                        disabled={testStatus === 'running'}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {testStatus === 'running' ? '테스트 실행 중...' : '진단 시작'}
                    </button>
                </div>

                <div className="bg-gray-900 text-green-400 rounded-lg p-6 font-mono text-sm overflow-auto" style={{ maxHeight: '600px' }}>
                    {logs.length === 0 ? (
                        <div className="text-gray-500">진단을 시작하려면 위 버튼을 클릭하세요.</div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className={`mb-2 ${log.type === 'error' ? 'text-red-400' :
                                    log.type === 'success' ? 'text-green-400' :
                                        'text-blue-300'
                                }`}>
                                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-bold text-yellow-800 mb-2">문제 해결 가이드:</h3>
                    <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• "client is offline" 오류가 나온다면: 브라우저 확장 프로그램(광고 차단기 등)을 비활성화하세요</li>
                        <li>• "permission-denied" 오류가 나온다면: Firestore 보안 규칙을 확인하세요</li>
                        <li>• "unavailable" 오류가 나온다면: 방화벽이나 보안 소프트웨어를 확인하세요</li>
                        <li>• 모든 테스트가 실패한다면: 시크릿 모드나 다른 브라우저에서 시도하세요</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default DiagnosticTest;
