const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('distributed code has no personal project, account paths or live tokens',()=>{
  const files=fs.readdirSync(root).filter(name=>/\.(js|json|html|md)$/.test(name));
  for(const file of files){
    const text=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal(/proj_[0-9a-f-]{36}|C:[\\/]Users[\\/]\d+|gh[opusr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|gemini\.google\.com\/app\/[0-9a-f]{12,}/.test(text),false,file);
  }
});
test('extension and package versions are kept in sync',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(manifest.version,pkg.version);
  assert.ok(fs.readFileSync(path.join(root,'content.js'),'utf8').includes('@version      '+manifest.version));
});
