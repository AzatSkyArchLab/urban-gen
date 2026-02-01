/**
 * LayerConfig - configuration for vector tile layers
 */

import { Config } from '../core/Config';

export interface CategoryStyle {
  color: string;
  width: number;
  label: string;
}

export interface VectorLayerConfig {
  id: string;
  name: string;
  sourceId: string;
  sourceLayer: string;
  type: 'line' | 'fill' | 'circle';
  visible: boolean;
  order: number;
  editable: boolean;
  style: {
    color: string;
    width?: number;
    opacity?: number;
    dasharray?: number[];
  };
  categoryField?: string;
  categoryStyles?: Record<string, CategoryStyle>;
}

export interface LayerState {
  id: string;
  visible: boolean;
  order: number;
  style: {
    color: string;
    width?: number;
    opacity?: number;
  };
}

// Road categories based on class_active_2016 field
// Gradient: Red (high priority) → Blue (low priority)
export const OSI_SUSH_STYLES: Record<string, CategoryStyle> = {
  'Магистральные городские дороги 1-го класса - скоростного движения': {
    color: '#dc2626',
    width: 7,
    label: 'Highways Class 1 (High-speed)'
  },
  'Магистральные улицы общегородского значения 1-го класса - непрерывного движения': {
    color: '#ea580c',
    width: 6.5,
    label: 'City Streets Class 1 (Continuous)'
  },
  'Магистральные городские дороги 2-го класса - регулируемого движения': {
    color: '#f97316',
    width: 6,
    label: 'Highways Class 2 (Regulated)'
  },
  'Магистральные улицы общегородского значения 2-го класса - регулируемого движения': {
    color: '#eab308',
    width: 5.5,
    label: 'City Streets Class 2 (Regulated)'
  },
  'Магистральные улицы общегородского значения 3-го класса - регулируемого движения': {
    color: '#84cc16',
    width: 5,
    label: 'City Streets Class 3 (Regulated)'
  },
  'Магистральные улицы районного значения': {
    color: '#22c55e',
    width: 4.5,
    label: 'District Streets'
  },
  'Улицы и дороги местного значения': {
    color: '#06b6d4',
    width: 4,
    label: 'Local Streets'
  },
  '-': {
    color: '#3b82f6',
    width: 3,
    label: 'Uncategorized'
  }
};

export const OSI_SUSH_DEFAULT_STYLE: CategoryStyle = {
  color: '#6b7280',
  width: 1.5,
  label: 'Other'
};

export const RED_LINES_STYLE = {
  color: '#ef4444',
  width: 2
};

// Vector layers from Martin server
export const VECTOR_LAYERS: VectorLayerConfig[] = [
  {
    id: 'red-lines',
    name: 'Red Lines',
    sourceId: 'martin-red-lines',
    sourceLayer: 'red_lines',
    type: 'line',
    visible: true,
    order: 100,
    editable: true,
    style: {
      color: RED_LINES_STYLE.color,
      width: RED_LINES_STYLE.width
    }
  },
  {
    id: 'osi-sush',
    name: 'Road Network (OSI)',
    sourceId: 'martin-osi-sush',
    sourceLayer: 'osi_sush',
    type: 'line',
    visible: true,
    order: 90,
    editable: false,
    style: {
      color: '#3b82f6',
      width: 2
    },
    categoryField: 'class_active_2016',
    categoryStyles: OSI_SUSH_STYLES
  }
];

export function getTileUrl(sourceLayer: string): string {
  return `${Config.api.martinBaseUrl}/${sourceLayer}/{z}/{x}/{y}`;
}

export function getCategoryColorExpression(
  field: string,
  styles: Record<string, CategoryStyle>,
  defaultColor: string
): any[] {
  const cases: any[] = ['case'];
  
  for (const [category, style] of Object.entries(styles)) {
    cases.push(['==', ['get', field], category]);
    cases.push(style.color);
  }
  
  cases.push(defaultColor);
  return cases;
}

export function getCategoryWidthExpression(
  field: string,
  styles: Record<string, CategoryStyle>,
  defaultWidth: number
): any[] {
  const cases: any[] = ['case'];
  
  for (const [category, style] of Object.entries(styles)) {
    cases.push(['==', ['get', field], category]);
    cases.push(style.width);
  }
  
  cases.push(defaultWidth);
  return cases;
}