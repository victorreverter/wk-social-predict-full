
const normalizeForMatch = (s) =>
    s.trim()
     .normalize('NFD')
     .replace(/[\u0300-\u036f]/g, '')
     .toLowerCase()
     .replace(/[^a-z0-9\s]/g, '')
     .replace(/\s+/g, ' ')
     .trim();

console.log('Mbappé:', normalizeForMatch('Mbappé'));
console.log('Mbappe:', normalizeForMatch('Mbappe'));
console.log('mbappe:', normalizeForMatch('mbappe'));
console.log('Lionel Messi:', normalizeForMatch('Lionel Messi'));
console.log('LIONEL messi:', normalizeForMatch('LIONEL messi'));
console.log(' Müller:', normalizeForMatch(' Müller'));
console.log('Muller:', normalizeForMatch('Muller'));
