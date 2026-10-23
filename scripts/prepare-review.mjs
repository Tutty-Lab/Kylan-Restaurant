import fs from 'node:fs/promises';
const {schedule} = JSON.parse(await fs.readFile('output/production-snapshot.json', 'utf8'));
const fixture = {employees: schedule.employees, workHours: schedule.workHours};
await fs.writeFile('src/lib/kylanReviewData.json', JSON.stringify(fixture, null, 2) + '\n');
