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

export const OSI_SUSH_STYLES: Record<string, CategoryStyle> = {
  'Магистральные улицы общегородского значения непрерывного движения': {
    color: '#b91c1c',
    width: 5,
    label: 'Highways (Continuous)'
  },
  'Магистральные улицы общегородского значения I класса': {
    color: '#dc2626',
    width: 4.5,
    label: 'City Streets Class I'
  },
  'Магистральные улицы общегородского значения I класса центра': {
    color: '#dc2626',
    width: 4.5,
    label: 'City Streets Class I (Center)'
  },
  'Магистральные улицы общегородского значения II класса': {
    color: '#ea580c',
    width: 4,
    label: 'City Streets Class II'
  },
  'Магистральные улицы общегородского значения II класса центра': {
    color: '#ea580c',
    width: 4,
    label: 'City Streets Class II (Center)'
  },
  'Магистральные улицы общегородского значения регулируемого движения': {
    color: '#f97316',
    width: 3.5,
    label: 'City Streets (Regulated)'
  },
  'Магистральные улицы районного значения': {
    color: '#fb923c',
    width: 3,
    label: 'District Streets'
  },
  'Магистральные улицы районного значения центра': {
    color: '#fb923c',
    width: 3,
    label: 'District Streets (Center)'
  },
  'Прочая улично-дорожная сеть Москвы': {
    color: '#facc15',
    width: 2,
    label: 'Other Roads'
  },
  'без категории': {
    color: '#9ca3af',
    width: 1.5,
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
    categoryField: 'kl_gp',
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