const fs = require('fs');
let code = fs.readFileSync('src/pages/ListingWrite.jsx', 'utf8');

const sImage = code.indexOf('{/* Image Upload */}');
const sTitle = code.indexOf('<div className="space-y-1">\\n'.replace(/\\n/g, '\n') + '                    <label className="font-bold text-sm">제목</label>') === -1 ? code.indexOf('<div className="space-y-1">\r\n                    <label className="font-bold text-sm">제목</label>') : code.indexOf('<div className="space-y-1">\n                    <label className="font-bold text-sm">제목</label>');

console.log(sImage, sTitle);
