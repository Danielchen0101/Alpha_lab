var fs = require('fs');
var path = 'C:/Users/kexuc/.openclaw/workspace/professional_quant_platform/frontend/src/pages/Portfolio.tsx';
var txt = fs.readFileSync(path, 'utf8');
var re = /<\/Option>\n\s+aiUsed:/;
var replacement = '</Option>\n                  </Select>\n                </Form.Item>\n              </Col>\n          aiUsed:';
txt = txt.replace(re, replacement);
fs.writeFileSync(path, txt, 'utf8');
console.log('Fixed, replaced:', txt.indexOf(replacement) >= 0);
