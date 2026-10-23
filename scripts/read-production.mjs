import fs from 'node:fs/promises';
const base = 'https://kylan-restaurant.vercel.app';
const page = await fetch(base);
if (!page.ok) throw new Error(`Kylan HTTP ${page.status}`);
const html = await page.text();
const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
let bundle = '';
for (const path of scripts) bundle += await (await fetch(new URL(path, base))).text();
const url = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const key = bundle.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
  ?? bundle.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
if (!url || !key) throw new Error('Public Supabase configuration not found');
const response = await fetch(`${url}/rest/v1/store_data?store_id=eq.kylan&select=data`,
  {headers: {apikey:key, Authorization:`Bearer ${key}`}});
if (!response.ok) throw new Error(`Read-only snapshot HTTP ${response.status}`);
const [{data}] = await response.json();
await fs.mkdir('output', {recursive:true});
await fs.writeFile('output/production-snapshot.json', JSON.stringify(data, null, 2));
console.log(JSON.stringify({employees:data.schedule.employees.map(e=>({id:e.id,name:e.name,hours:e.targetMinutes/60,isOwner:e.isOwner})),workHours:data.schedule.workHours,year:data.schedule.year,month:data.schedule.month}, null, 2));
