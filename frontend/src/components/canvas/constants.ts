import type { Sector } from './types';

export const sectors: Sector[] = [
    { name: 'Manufacturing', color: '#F64C46' },
    { name: 'Services', color: '#7AC758' },
    { name: 'Agriculture', color: '#00ADB0' },
    { name: 'Retail', color: '#F5911C' },
    { name: 'Property', color: '#B4CA50' },
    { name: 'Energy', color: '#EA4335' },
    // # 4764A0 (Background)
];

// Map sector names to colors for quick lookup
export const sectorColorMap = sectors.reduce((acc, sector) => {
    acc[sector.name] = sector.color;
    return acc;
}, {} as Record<string, string>);