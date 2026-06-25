import React, { createContext, useContext, useState, useEffect } from 'react';

const CompareContext = createContext();

export const useCompare = () => useContext(CompareContext);

export const CompareProvider = ({ children }) => {
    const [compareList, setCompareList] = useState([]);

    // 로컬 스토리지에서 초기값 불러오기
    useEffect(() => {
        const stored = localStorage.getItem('estate_compare_list');
        if (stored) {
            try {
                setCompareList(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse compare list", e);
            }
        }
    }, []);

    // 상태 변경 시 로컬 스토리지에 저장
    useEffect(() => {
        localStorage.setItem('estate_compare_list', JSON.stringify(compareList));
    }, [compareList]);

    const addToCompare = (listing) => {
        if (compareList.find(item => item.id === listing.id)) {
            alert('이미 비교함에 담긴 매물입니다.');
            return;
        }
        if (compareList.length >= 3) {
            alert('비교하기는 최대 3개까지만 담을 수 있습니다.');
            return;
        }
        // Save only essential fields to avoid saving huge objects in localStorage
        const essentialData = {
            id: listing.id,
            title: listing.title,
            transactionType: listing.transactionType,
            price: listing.price,
            deposit: listing.deposit,
            monthlyRent: listing.monthlyRent,
            managementFee: listing.managementFee,
            propertySpecs: listing.propertySpecs || {},
            address: listing.address || {},
            location: listing.location,
            imageUrl: listing.imageUrl,
            propertyType: listing.propertyType
        };
        
        setCompareList(prev => [...prev, essentialData]);
    };

    const removeFromCompare = (id) => {
        setCompareList(prev => prev.filter(item => item.id !== id));
    };

    const clearCompare = () => {
        setCompareList([]);
    };

    const isCompared = (id) => {
        return compareList.some(item => item.id === id);
    };

    return (
        <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, clearCompare, isCompared }}>
            {children}
        </CompareContext.Provider>
    );
};
