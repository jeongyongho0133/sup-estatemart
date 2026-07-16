import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '../components/layout/MobileLayout';

const About = () => {
    const navigate = useNavigate();

    return (
        <MobileLayout>
            <header className='sticky top-0 bg-white z-10 px-4 h-14 flex items-center border-b border-gray-100'>
                <button onClick={() => navigate(-1)} className='mr-4 text-gray-600'>
                    <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                    </svg>
                </button>
                <h1 className='font-bold text-lg text-gray-900'>{'회사소개'}</h1>
            </header>

            <div className='bg-gradient-to-b from-orange-50 via-white to-gray-50 min-h-screen pb-24'>
                {/* Hero Section */}
                <div className='px-6 py-12 text-center relative overflow-hidden'>
                    <div className='absolute -top-10 -right-10 w-40 h-40 bg-orange-200 rounded-full blur-3xl opacity-30'></div>
                    <div className='absolute -bottom-10 -left-10 w-40 h-40 bg-orange-300 rounded-full blur-3xl opacity-20'></div>

                    <div className='inline-block bg-orange-100 text-market-orange text-[10px] px-3 py-1 rounded-full font-bold mb-4 animate-bounce'>
                        {'Premium Proptech Platform'}
                    </div>
                    <h2 className='text-3xl font-black text-gray-900 leading-tight mb-4'>
                        {'AI로 만나는'}<br />
                        {'최적의 주거 공간'}<br />
                        <span className='text-market-orange'>{'집터로 AI'}</span>
                    </h2>
                    <p className='text-xs text-gray-500 leading-relaxed max-w-sm mx-auto'>
                        {'집터로 AI는 첨단 AI 알고리즘과 공간 데이터 분석을 기반으로 사용자의 라이프스타일에 정확히 맞는 최적의 매물을 추천하고 진단하는 혁신적인 프롭테크 플랫폼입니다.'}
                    </p>
                </div>
                {/* Core Values */}
                <div className='px-5 mb-8'>
                    <h3 className='text-sm font-bold text-gray-800 mb-4 px-1'>{'미래의 기반'}</h3>
                    <div className='grid grid-cols-3 gap-3'>
                        <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center transform transition hover:scale-105'>
                            <span className='text-2xl block mb-2'>{'🔍'}</span>
                            <h4 className='text-xs font-bold text-gray-800 mb-1'>{'집을 짓는 터'}</h4>
                            <p className='text-[9px] text-gray-400 leading-normal'>{'집을 짓는 터(대지)를 고를 때는 진입로 여부, 땅의 방향과 경사도, 그리고 기반 시설(상하수도, 전기) 연결 가능성을 가장 먼저 확인해야 합니다. 땅의 조건은 건축 비용과 직결되므로 전문가의 현장 답사가 필수적입니다'}</p>
                        </div>
                        <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center transform transition hover:scale-105'>
                            <span className='text-2xl block mb-2'>{'🤝'}</span>
                            <h4 className='text-xs font-bold text-gray-800 mb-1'>{'사업의 터'}</h4>
                            <p className='text-[9px] text-gray-400 leading-normal'>{'성공적인 사업의 터(입지)를 선정할 때는 타깃 고객의 접근성, 주변 상권 및 경쟁 환경, 예산 대비 비용 효율성, 법적/행정적 입지 조건 등 4가지 핵심 기준을 종합적으로 분석해야 합니다.'}</p>
                        </div>
                        <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center transform transition hover:scale-105'>
                            <span className='text-2xl block mb-2'>{'⚡'}</span>
                            <h4 className='text-xs font-bold text-gray-800 mb-1'>{'삶의 터전'}</h4>
                            <p className='text-[9px] text-gray-400 leading-normal'>{'사람이 살아가거나 생계를 유지하는 근거지가 되는 장소나 환경'}</p>
                        </div>
                    </div>
                </div>

                {/* Core Values */}
                <div className='px-5 mb-8'>
                    <h3 className='text-sm font-bold text-gray-800 mb-4 px-1'>{'핵심 가치'}</h3>
                    <div className='grid grid-cols-3 gap-3'>
                        <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center transform transition hover:scale-105'>
                            <span className='text-2xl block mb-2'>{'🔍'}</span>
                            <h4 className='text-xs font-bold text-gray-800 mb-1'>{'정확성'}</h4>
                            <p className='text-[9px] text-gray-400 leading-normal'>{'정밀한 데이터 진단'}</p>
                        </div>
                        <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center transform transition hover:scale-105'>
                            <span className='text-2xl block mb-2'>{'🤝'}</span>
                            <h4 className='text-xs font-bold text-gray-800 mb-1'>{'신뢰성'}</h4>
                            <p className='text-[9px] text-gray-400 leading-normal'>{'투명한 중개 서비스'}</p>
                        </div>
                        <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center transform transition hover:scale-105'>
                            <span className='text-2xl block mb-2'>{'⚡'}</span>
                            <h4 className='text-xs font-bold text-gray-800 mb-1'>{'신속성'}</h4>
                            <p className='text-[9px] text-gray-400 leading-normal'>{'원스톱 비대면 계약'}</p>
                        </div>
                    </div>
                </div>

                {/* Service Features */}
                <div className='px-5 mb-8'>
                    <h3 className='text-sm font-bold text-gray-800 mb-4 px-1'>{'주요 서비스'}</h3>
                    <div className='space-y-4'>
                        <div className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4'>
                            <div className='p-3 bg-orange-50 rounded-xl text-xl shrink-0'>{'🤖'}</div>
                            <div>
                                <h4 className='text-xs font-bold text-gray-800 mb-1'>{'AI 맞춤 추천 서비스'}</h4>
                                <p className='text-[10px] text-gray-400 leading-relaxed'>
                                    {'고객의 예산, 학군, 교통 등 개인 맞춤형 데이터를 분석하여 최적의 추천 점수를 갖춘 매물을 우선적으로 매칭해 드립니다.'}
                                </p>
                            </div>
                        </div>

                        <div className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4'>
                            <div className='p-3 bg-blue-50 rounded-xl text-xl shrink-0'>{'🗺️'}</div>
                            <div>
                                <h4 className='text-xs font-bold text-gray-800 mb-1'>{'다차원 공간 지도 분석'}</h4>
                                <p className='text-[10px] text-gray-400 leading-relaxed'>
                                    {'카카오, 네이버, 구글 지도의 유기적인 연동과 거리 로드뷰 기능을 지원하여, 매물 위치와 주변 상권을 실제 가보지 않고도 완벽하게 시뮬레이션할 수 있습니다.'}
                                </p>
                            </div>
                        </div>

                        <div className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4'>
                            <div className='p-3 bg-green-50 rounded-xl text-xl shrink-0'>{'📝'}</div>
                            <div>
                                <h4 className='text-xs font-bold text-gray-800 mb-1'>{'원스톱 비대면 전자 계약'}</h4>
                                <p className='text-[10px] text-gray-400 leading-relaxed'>
                                    {'온라인으로 간편하게 주택 임대차/매매 계약서를 작성하고, 서명부터 출력까지 원스톱으로 처리하여 불필요한 서류 작업을 최소화합니다.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Company Info */}
                <div className='px-5'>
                    <div className='bg-gray-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden'>
                        <div className='absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full blur-3xl opacity-20'></div>
                        <h3 className='text-sm font-bold mb-4 text-orange-400'>{'기업 정보'}</h3>
                        <div className='space-y-3 text-[11px] text-gray-300 leading-relaxed'>
                            <div className='flex justify-between border-b border-gray-800 pb-2'>
                                <span className='text-gray-400'>{'회사명'}</span>
                                <span className='font-bold'>{'(주) 집터로'}</span>
                            </div>
                            <div className='flex justify-between border-b border-gray-800 pb-2'>
                                <span className='text-gray-400'>{'대표이사'}</span>
                                <span className='font-bold'>{'정용호'}</span>
                            </div>
                            <div className='flex justify-between border-b border-gray-800 pb-2'>
                                <span className='text-gray-400'>{'본사 주소'}</span>
                                <span className='font-bold text-right'>{'전북특별자치도 전주시 완산구 장승배기로 132, 2층'}</span>
                            </div>
                            <div className='flex justify-between border-b border-gray-800 pb-2'>
                                <span className='text-gray-400'>{'대표번호'}</span>
                                <span className='font-bold'>{'063-273-0133'}</span>
                            </div>
                            <div className='flex justify-between pb-1'>
                                <span className='text-gray-400'>{'이메일'}</span>
                                <span className='font-bold'>{'grand1500@naver.com'}</span>
                            </div>
                        </div>
                        <p className='text-[9px] text-gray-500 text-center mt-6 leading-normal'>
                            {'© 2026 JipTeoRo Korea Inc. All rights reserved.'}
                        </p>
                    </div>
                </div>
            </div>
        </MobileLayout>
    );
};

export default About;
