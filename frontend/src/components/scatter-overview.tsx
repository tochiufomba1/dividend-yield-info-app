import { ScatterChart, type ScatterSeries } from '@mui/x-charts';
import Stack from '@mui/material/Stack';

const chartSetting = {
  yAxis: [{ width: 50, scaleType: 'log' as const }],
  xAxis: [{ valueFormatter: (v: number | null) => (v ? v.toString() : '') }],
};

export default function ScatterOverview({
    series
}:{
    series: readonly ScatterSeries[]
}) {
  return (
    <Stack width="100%">
      {/* <Typography align="center">Processor density (in transistor/mm²)</Typography> */}
      <ScatterChart
        height={300}
        series={series}
        grid={{ horizontal: true, vertical: true }}
        voronoiMaxRadius={20}
        {...chartSetting}
      />
    </Stack>
  );
}