import { createChart, ColorType, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

interface ChartData {
  time: string;
  value: number;
}

interface Props {
  data: ChartData[];
  pair: string;
}

export default function TradingViewChart({ data, pair }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Clean up any existing chart
    chartContainerRef.current.innerHTML = '';

    try {
      // Create new chart
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { 
            type: ColorType.Solid,
            color: 'rgba(26, 29, 38, 0.9)'
          },
          textColor: '#d1d5db',
        },
        grid: {
          vertLines: { 
            color: 'rgba(44, 48, 64, 0.5)',
          },
          horzLines: { 
            color: 'rgba(44, 48, 64, 0.5)',
          },
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Create area series
      const areaSeries = chart.addAreaSeries({
        lineColor: '#3b82f6',
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      });

      // Format and set data
      const formattedData = data.map(item => ({
        time: parseInt(item.time) as UTCTimestamp,
        value: item.value,
      }));

      areaSeries.setData(formattedData);

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      // Fit content and set visible range
      chart.timeScale().fitContent();
      
      // Set visible range to last 24 hours
      const lastPoint = formattedData[formattedData.length - 1];
      const firstPoint = formattedData[0];
      if (lastPoint && firstPoint) {
        chart.timeScale().setVisibleRange({
          from: firstPoint.time,
          to: lastPoint.time,
        });
      }

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    } catch (err) {
      console.error('Error creating chart:', err);
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = 'Error loading chart';
      }
    }
  }, [data, pair]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-gray-800/50 rounded-lg">
        <div className="text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] bg-gray-800/50 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 text-gray-300 font-semibold z-10 bg-gray-800/80 px-3 py-1 rounded-lg">
        {pair}
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
} 