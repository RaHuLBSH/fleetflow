import { demoTrend } from "../demo";

function points(values: number[], max: number, width = 560, height = 180) {
  return values.map((value, index) => `${(index / (values.length - 1)) * width},${height - (value / max) * height}`).join(" ");
}

export function TrendChart() {
  const complete = points(demoTrend.completed, 60); const transit = points(demoTrend.transit, 60); const delayed = points(demoTrend.delayed, 60);
  return <div className="trend-chart-wrap"><div className="chart-legend"><span><i className="chart-green" />Completed</span><span><i className="chart-blue" />In transit</span><span><i className="chart-red" />Delayed</span><small>Illustrative trend · analytics endpoint unavailable</small></div><svg className="trend-chart" viewBox="0 0 600 240" role="img" aria-label="Illustrative shipment activity over seven days"><g className="chart-grid">{[0, 1, 2, 3].map((n) => <line key={n} x1="35" x2="595" y1={25 + n * 55} y2={25 + n * 55} />)}</g><g transform="translate(35 25)"><polygon points={`0,180 ${complete} 560,180`} className="area-green"/><polygon points={`0,180 ${transit} 560,180`} className="area-blue"/><polyline points={complete} className="line-green"/><polyline points={transit} className="line-blue"/><polyline points={delayed} className="line-red"/></g><g className="chart-labels">{demoTrend.labels.map((label, i) => <text key={label} x={35 + i * (560 / 6)} y="228" textAnchor="middle">{label}</text>)}</g></svg></div>;
}
