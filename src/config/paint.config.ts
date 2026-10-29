/** 彩繪室數值 */
export const PAINT = {
  /** 每一面在貼圖上的格子邊長（px） */
  cell: 256,
  /** 每格四周的留白（px），防止取樣時相鄰面顏色滲入 */
  gutter: 4,
  undoSteps: 30,
  /** 轉向一次的角度（弧度） */
  turnStep: Math.PI / 4,
  /** 初始角度 */
  initialTurn: 0.25,
  turnRate: 8,
  /** 筆刷粗細（場景單位） */
  brushes: [
    { id: 'thin', label: '細', width: 0.035, dot: 6 },
    { id: 'medium', label: '中', width: 0.07, dot: 10 },
    { id: 'thick', label: '粗', width: 0.14, dot: 16 },
  ],
  eraserScale: 1.8,
  /** 固定 16 色 */
  colors: [
    { name: '黑', hex: '#1E1E1E' },
    { name: '白', hex: '#FFFFFF' },
    { name: '灰', hex: '#9A9A9A' },
    { name: '深灰', hex: '#555555' },
    { name: '棕', hex: '#8B5A2B' },
    { name: '紅', hex: '#E53935' },
    { name: '橙', hex: '#FB8C00' },
    { name: '黃', hex: '#FDD835' },
    { name: '綠', hex: '#43A047' },
    { name: '藍', hex: '#1E63D6' },
    { name: '紫', hex: '#8E44AD' },
    { name: '粉', hex: '#F48FB1' },
    { name: '膚色淺', hex: '#F6D7C3' },
    { name: '膚色中', hex: '#E0AC84' },
    { name: '膚色深', hex: '#A86B45' },
    { name: '天藍', hex: '#64B5F6' },
  ],
} as const;
