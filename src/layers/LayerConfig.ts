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
    color: '#dc2626',
    width: 4,
    label: 'City Highways'
  },
  'Магистральные городские дороги 2-го класса - регулируемого движения': {
    color: '#ea580c',
    width: 3.5,
    label: 'Urban Roads Class 2'
  },
  'Магистральные улицы общегородского значения 2-го класса - регулируемого движения': {
    color: '#d97706',
    width: 3,
    label: 'City Streets Class 2'
  },
  'Магистральные улицы районного значения': {
    color: '#ca8a04',
    width: 2.5,
    label: 'District Streets'
  },
  'Улицы и дороги местного значения': {
    color: '#65a30d',
    width: 2,
    label: 'Local Streets'
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
  width: 2,
  dasharray: [4, 2] as [number, number]
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
      width: RED_LINES_STYLE.width,
      dasharray: RED_LINES_STYLE.dasharray
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
  // Use URL-based auth to avoid CORS preflight issues with Authorization header
  const baseUrl = Config.api.martinBaseUrl.replace('https://', `https://${Config.api.martinAuth}@`);
  return `${baseUrl}/${sourceLayer}/{z}/{x}/{y}`;
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