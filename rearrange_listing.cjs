const fs = require('fs');
const filepath = 'src/pages/ListingWrite.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// We will explicitly delimit the blocks using their exact unique string signatures.

function extractBlock(startMarker, endMarker, offsetEnd = 0, nextMarkerHint = null) {
    const start = code.indexOf(startMarker);
    if(start === -1) throw new Error("Marker not found: " + startMarker);
    
    let end = -1;
    if (nextMarkerHint) {
        end = code.indexOf(nextMarkerHint, start);
    } else {
        end = code.indexOf(endMarker, start);
    }
    
    if(end === -1) throw new Error("End marker not found: " + endMarker);
    end += offsetEnd;
    
    return code.substring(start, end);
}

const cImage = extractBlock('{/* Image Upload */}', '<div className="space-y-1">\\n                    <label className="font-bold text-sm">제목</label>', 0, '<div className="space-y-1">\\n                    <label className="font-bold text-sm">제목</label>');
const cTitle = extractBlock('<div className="space-y-1">\\n                    <label className="font-bold text-sm">제목</label>', '{/* Premium / Add-ons UI */}', 0, '{/* Premium / Add-ons UI */}');
const cPremium = extractBlock('{/* Premium / Add-ons UI */}', '<div className="space-y-3">\\n                    <label className="font-bold text-sm">위치</label>', 0, '<div className="space-y-3">\\n                    <label className="font-bold text-sm">위치</label>');
const cLocation = extractBlock('<div className="space-y-3">\\n                    <label className="font-bold text-sm">위치</label>', '<div className="space-y-2">\\n                    <label className="font-bold text-sm">매물 종류</label>', 0, '<div className="space-y-2">\\n                    <label className="font-bold text-sm">매물 종류</label>');
const cCategory = extractBlock('<div className="space-y-2">\\n                    <label className="font-bold text-sm">매물 종류</label>', '<div className="space-y-2">\\n                    <label className="font-bold text-sm">거래 방식</label>', 0, '<div className="space-y-2">\\n                    <label className="font-bold text-sm">거래 방식</label>');
const cTrans = extractBlock('<div className="space-y-2">\\n                    <label className="font-bold text-sm">거래 방식</label>', '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\\n                    <label className="font-bold text-sm">가격 정보</label>', 0, '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\\n                    <label className="font-bold text-sm">가격 정보</label>');
const cPrice = extractBlock('<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\\n                    <label className="font-bold text-sm">가격 정보</label>', '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\\n                    <label className="font-bold text-sm">기본 정보</label>', 0, '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\\n                    <label className="font-bold text-sm">기본 정보</label>');

// Second group: Basic, Date are already in correct relative order at bottom of Price. We just need to swap descriptions and broker info.
const cBasicToDate = extractBlock('<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\\n                    <label className="font-bold text-sm">기본 정보</label>', '<div className="space-y-2 border-t pt-4">\\n                    <label className="font-bold text-sm">중개사 정보</label>', 0, '<div className="space-y-2 border-t pt-4">\\n                    <label className="font-bold text-sm">중개사 정보</label>');

// Important: Note that we look for `<div className="space-y-4">` because there is a wrapper for Manual + AI desc around line 890.
const cBroker = extractBlock('<div className="space-y-2 border-t pt-4">\\n                    <label className="font-bold text-sm">중개사 정보</label>', '<div className="space-y-4">\\n                    <div className="space-y-1">\\n                        <label className="font-bold text-sm">상세 설명 (직접 작성)</label>', 0, '<div className="space-y-4">\\n                    <div className="space-y-1">\\n                        <label className="font-bold text-sm">상세 설명 (직접 작성)</label>');

// The rest of the file from Description to end
// "상세 설명" -> "AI 설명" -> "PaymentModal" (in a single block)
const tailStart = code.indexOf('<div className="space-y-4">\\n                    <div className="space-y-1">\\n                        <label className="font-bold text-sm">상세 설명 (직접 작성)</label>');
const cTailDescAndOut = code.substring(tailStart);

const headCode = code.substring(0, code.indexOf('{/* Image Upload */}'));


// Order: 
// 1. 매물종류: cCategory
// 2. 거래방식: cTrans
// 3. 가격정보: cPrice
// 4. 매물위치: cLocation
// 5. 매물제목: cTitle
// + Premium: cPremium
// 6. 사진등록: cImage
// 7. 기본정보: cBasicToDate (has both basic and date)
// 8. 일자정보: (included in cBasicToDate)
// 9. 상세설명: (top part of tailDescAndOut)
// 10. AI 설명: (mid part of tailDescAndOut)
// 11. 중개사 정보: cBroker (move this to the very bottom BEFORE PaymentModal)

// Let's further split description from PaymentModal so we can insert cBroker between them.
const paymentStart = cTailDescAndOut.indexOf('</div>\\n            </div>\\n\\n            <PaymentModal');
const cDescriptions = cTailDescAndOut.substring(0, paymentStart + 7); // include '</div>\n'
const cFooter = cTailDescAndOut.substring(paymentStart + 7);

const newCode = headCode 
    + cCategory 
    + cTrans 
    + cPrice 
    + cLocation 
    + cTitle 
    + cPremium 
    + cImage 
    + cBasicToDate 
    + cDescriptions 
    + "            " + cBroker.trim() + "\n"
    + cFooter;

fs.writeFileSync(filepath, newCode, 'utf8');
console.log("Rearranged ListingWrite.jsx Successfully.");
