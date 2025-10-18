/** eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
} from "lightweight-charts";
import useStore from "../../store/store";
// import { toast } from "sonner";
// import { API_URL } from "../../config/config";
// import axios from "axios";
// import cookies from "js-cookie";

interface TradingViewChartProps {
  symbol: string;
  timeframe: string;
  chartType: "line" | "candlestick";
  tradeId: string;
  chartData: CandlestickData[];
  isLoading: boolean;
  onRefreshData: () => void;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  tradeId,
  chartType = "candlestick",
  chartData,
  isLoading,
  onRefreshData,
}) => {
  const { optionValues } = useStore();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const chartPositionRef = useRef<{ x: number; y: number } | null>(null);

  const [cursor] = useState("default");

  const lastCandleDataRef = useRef<{
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  const [chartReady, setChartReady] = useState(false);

  const transformDataForChartType = (
    rawData: CandlestickData[]
  ): CandlestickData[] | LineData[] => {
    const newData = removeIfNotEndingWith59(rawData);
    if (chartType === "line") {
      return newData.map((candle) => ({
        time: candle.time,
        value: candle.close,
      }));
    }
    return rawData;
  };

  // Live data updates
  useEffect(() => {
    if (!chartReady) return;

    const series = candleSeriesRef.current || lineSeriesRef.current;
    if (!series) return;

    const option = optionValues.find((t) => t.id === tradeId);
    if (!option?.lowestCombinedPremium) return;

    const liveValue = option.lowestCombinedPremium;

    const candleTime = getISTAlignedTimeInSeconds();

    if (chartType === "candlestick") {
      if (
        !lastCandleDataRef.current ||
        lastCandleDataRef.current.time !== candleTime
      ) {
        lastCandleDataRef.current = {
          time: candleTime as Time,
          open: liveValue,
          high: liveValue,
          low: liveValue,
          close: liveValue,
        };
      } else {
        lastCandleDataRef.current.high = Math.max(
          lastCandleDataRef.current.high,
          liveValue
        );
        lastCandleDataRef.current.low = Math.min(
          lastCandleDataRef.current.low,
          liveValue
        );
        lastCandleDataRef.current.close = liveValue;
      }
      (series as ISeriesApi<"Candlestick">).update(lastCandleDataRef.current);
    } else {
      (series as ISeriesApi<"Line">).update({
        time: candleTime as Time,
        value: liveValue,
      });
    }
  }, [chartReady, optionValues, tradeId, chartType]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let chart: IChartApi | null = null;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting) {
          chart = createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: { background: { color: "#1f2937" }, textColor: "#d1d5db" },
            grid: {
              vertLines: { visible: false, color: "#374151" },
              horzLines: { visible: false, color: "#374151" },
            },
            timeScale: { timeVisible: true },
            crosshair: { mode: 0 },
            handleScale: {
              axisPressedMouseMove: { time: true, price: true },
              mouseWheel: true,
              pinch: true,
            },
            handleScroll: {
              mouseWheel: true,
              horzTouchDrag: true,
              vertTouchDrag: true,
            },
          });

          if (!chart) {
            console.error("Failed to create chart instance");
            return;
          }

          chartRef.current = chart;
          setChartReady(true);

          const resizeChart = () => {
            if (chartRef.current && chartContainerRef.current) {
              const rect = chartContainerRef.current.getBoundingClientRect();
              chartRef.current.applyOptions({
                width: rect.width,
                height: rect.height,
              });
              chartRef.current.timeScale().fitContent();
            }
          };

          resizeObserverRef.current = new ResizeObserver(() =>
            requestAnimationFrame(resizeChart)
          );
          resizeObserverRef.current.observe(container);

          setTimeout(resizeChart, 100);
          observer.unobserve(container);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      resizeObserverRef.current?.disconnect();

      if (chart) {
        try {
          chart.remove();
        } catch (error) {
          console.warn("Chart disposal error:", error);
        }
        chart = null;
      }

      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      setChartReady(false);
    };
  }, [chartContainerRef.current]);

  // Update chart when data or chart type changes
  useEffect(() => {
    if (!chartRef.current || !chartReady || !chartData.length) return;

    // Save current chart position before updating
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      if (visibleRange) {
        chartPositionRef.current = {
          x: visibleRange.from as number,
          y: visibleRange.to as number,
        };
      }
    }

    // Remove existing series
    if (candleSeriesRef.current) {
      chartRef.current.removeSeries(candleSeriesRef.current);
      candleSeriesRef.current = null;
    }
    if (lineSeriesRef.current) {
      chartRef.current.removeSeries(lineSeriesRef.current);
      lineSeriesRef.current = null;
    }

    console.log(chartData);
    // Transform data and create new series

    const transformedData = transformDataForChartType(chartData);

    if (chartType === "candlestick") {
      const candleSeries = chartRef.current.addCandlestickSeries({
        upColor: "#10b981",
        downColor: "#ef4444",
        borderDownColor: "#ef4444",
        borderUpColor: "#10b981",
        wickDownColor: "#ef4444",
        wickUpColor: "#10b981",
      });
      candleSeries.setData(transformedData as CandlestickData[]);
      candleSeriesRef.current = candleSeries;
    } else {
      const lineSeries = chartRef.current.addLineSeries({
        color: "#3b82f6",
        lineWidth: 2,
      });
      lineSeries.setData(transformedData as LineData[]);
      lineSeriesRef.current = lineSeries;
    }

    // Restore chart position if available, otherwise fit content
    if (chartPositionRef.current) {
      chartRef.current.timeScale().setVisibleRange({
        from: chartPositionRef.current.x as Time,
        to: chartPositionRef.current.y as Time,
      });
    } else {
      chartRef.current.timeScale().fitContent();
    }
  }, [chartData, chartType, chartReady]);

  if (isLoading && !chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p>No chart data available</p>
          <button
            onClick={onRefreshData}
            className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full relative"
      style={{ cursor }}
    ></div>
  );
};

function removeIfNotEndingWith59(
  chartData: CandlestickData<Time>[]
): CandlestickData<Time>[] {
  if (chartData.length === 0) return chartData;

  const last = chartData[chartData.length - 1];

  // Safely assert time is a number
  const timestamp = typeof last.time === "number" ? last.time : undefined;

  if (timestamp !== undefined) {
    const lastSeconds = timestamp % 60;

    if (lastSeconds !== 59) {
      chartData.pop(); // Remove last item
      console.log("removed");
    }
  }

  return chartData;
}

const getISTAlignedTimeInSeconds = () => {
  const istOffsetMinutes = 5.5 * 60;
  const currentTimeIST = Date.now() + istOffsetMinutes * 60 * 1000 + 50;
  const currentTimeGMTSeconds = Math.floor(currentTimeIST / 1000);
  return currentTimeGMTSeconds - (currentTimeGMTSeconds % 60);
};

export default TradingViewChart;
