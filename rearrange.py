import re

with open('src/pages/ListingWrite.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

def extract(start_str, end_str):
    s = code.find(start_str)
    if s == -1: raise Exception("start " + repr(start_str) + " not found")
    e = code.find(end_str, s)
    if e == -1: raise Exception("end " + repr(end_str) + " not found")
    return code[s:e]

cImg = extract('{/* Image Upload */}', '<div className="space-y-1">\n                    <label className="font-bold text-sm">제목</label>')
cTitle = extract('<div className="space-y-1">\n                    <label className="font-bold text-sm">제목</label>', '{/* Premium / Add-ons UI */}')
cPremium = extract('{/* Premium / Add-ons UI */}', '<div className="space-y-3">\n                    <label className="font-bold text-sm">위치</label>')
cLoc = extract('<div className="space-y-3">\n                    <label className="font-bold text-sm">위치</label>', '<div className="space-y-2">\n                    <label className="font-bold text-sm">매물 종류</label>')
cCat = extract('<div className="space-y-2">\n                    <label className="font-bold text-sm">매물 종류</label>', '<div className="space-y-2">\n                    <label className="font-bold text-sm">거래 방식</label>')
cTrans = extract('<div className="space-y-2">\n                    <label className="font-bold text-sm">거래 방식</label>', '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\n                    <label className="font-bold text-sm">가격 정보</label>')
cPrice = extract('<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\n                    <label className="font-bold text-sm">가격 정보</label>', '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\n                    <label className="font-bold text-sm">기본 정보</label>')

sDate = '<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\n                    <label className="font-bold text-sm">일자 정보</label>'
sBroker = '<div className="space-y-2 border-t pt-4">\n                    <label className="font-bold text-sm">중개사 정보</label>'
sDesc = '<div className="space-y-4">\n                    <div className="space-y-1">\n                        <label className="font-bold text-sm">상세 설명 (직접 작성)</label>'
sPayment = '<PaymentModal'

cBasic = extract('<div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4">\n                    <label className="font-bold text-sm">기본 정보</label>', sDate)
cDate = extract(sDate, sBroker)
cBroker = extract(sBroker, sDesc)

# Because we need to split descriptions correctly:
p1 = code.find(sDesc)
p2 = code.find('</div>\n            </div>\n\n            <PaymentModal', p1)
cDescriptions = code[p1:p2]

# Build result
new_mid = cCat + cTrans + cPrice + cLoc + cTitle + cPremium + cImg + cBasic + cDate + cDescriptions + "</div>\n" + cBroker + "            </div>\n\n            "

# Replace
old_start = code.find('{/* Image Upload */}')
old_end = code.find('<PaymentModal')
result = code[:old_start] + new_mid + code[old_end:]

with open('src/pages/ListingWrite.jsx', 'w', encoding='utf-8') as f:
    f.write(result)
print("Done")
