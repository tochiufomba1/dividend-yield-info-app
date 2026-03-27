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

export const GICSSectors : Sector[] = [
    {name: 'Energy', color: '#5F4690' },
    {name: 'Materials', color: '#1D6996' },
    {name: 'Industrials', color: '#38A6A5' },
    {name: 'Utilities', color:'#0F8554' },
    {name: 'Healthcare', color: '#73AF48' },
    {name: 'Financials', color: '#EDAD08'},
    {name: 'Consumer Discretionary', color: '#E17C05'},
    {name: 'Consumer Staples', color: '#CC503E'},
    {name: 'Information Technology', color: '#94346E'},
    {name: 'Communication Services', color: '#6F4070'},
    {name: 'Real Estate', color: '#994E95'},
]