/**
 * ImportDialog - Modal dialog for importing GeoJSON files
 *
 * Features:
 * - Drag & drop file upload
 * - File browser
 * - Name/description input
 * - Upload progress
 */

import { eventBus } from '../../core/EventBus';
import { geoJSONImporter } from '../../import/GeoJSONImporter';

const ICONS = {
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`
};

type DialogState = 'idle' | 'uploading' | 'success' | 'error';

export class ImportDialog {
  private overlay: HTMLElement | null = null;
  private selectedFile: File | null = null;
  private state: DialogState = 'idle';
  private errorMessage: string = '';

  /**
   * Show the import dialog
   */
  show(): void {
    this.state = 'idle';
    this.selectedFile = null;
    this.errorMessage = '';
    this.createDialog();
    this.setupEventListeners();
  }

  /**
   * Hide the import dialog
   */
  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private createDialog(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'import-dialog-overlay';
    this.overlay.innerHTML = this.renderDialog();
    document.body.appendChild(this.overlay);
  }

  private renderDialog(): string {
    return `
      <div class="import-dialog">
        <div class="import-dialog-header">
          <h2>Import GeoJSON</h2>
          <button class="import-dialog-close" data-action="close">
            ${ICONS.close}
          </button>
        </div>

        <div class="import-dialog-body">
          ${this.renderContent()}
        </div>

        <div class="import-dialog-footer">
          <button class="import-btn import-btn-secondary" data-action="close">
            Cancel
          </button>
          <button class="import-btn import-btn-primary" data-action="upload" ${this.selectedFile ? '' : 'disabled'}>
            Upload
          </button>
        </div>
      </div>
    `;
  }

  private renderContent(): string {
    switch (this.state) {
      case 'uploading':
        return this.renderUploading();
      case 'success':
        return this.renderSuccess();
      case 'error':
        return this.renderError();
      default:
        return this.renderDropzone();
    }
  }

  private renderDropzone(): string {
    return `
      <div class="import-dropzone" data-action="dropzone">
        <div class="import-dropzone-icon">${ICONS.upload}</div>
        <div class="import-dropzone-text">
          <p>Drag & drop your GeoJSON file here</p>
          <p class="import-dropzone-hint">or click to browse</p>
        </div>
        <input type="file" class="import-file-input" accept=".geojson,.json" />
      </div>

      ${this.selectedFile ? this.renderSelectedFile() : ''}

      <div class="import-form">
        <div class="import-field">
          <label for="layer-name">Layer Name (optional)</label>
          <input type="text" id="layer-name" class="import-input" placeholder="Enter layer name..." />
        </div>
        <div class="import-field">
          <label for="layer-description">Description (optional)</label>
          <textarea id="layer-description" class="import-input" rows="2" placeholder="Enter description..."></textarea>
        </div>
      </div>
    `;
  }

  private renderSelectedFile(): string {
    if (!this.selectedFile) return '';

    const sizeKB = (this.selectedFile.size / 1024).toFixed(1);
    return `
      <div class="import-selected-file">
        <div class="import-file-icon">${ICONS.file}</div>
        <div class="import-file-info">
          <div class="import-file-name">${this.selectedFile.name}</div>
          <div class="import-file-size">${sizeKB} KB</div>
        </div>
        <button class="import-file-remove" data-action="remove-file">
          ${ICONS.close}
        </button>
      </div>
    `;
  }

  private renderUploading(): string {
    return `
      <div class="import-status">
        <div class="import-spinner"></div>
        <p>Uploading ${this.selectedFile?.name}...</p>
      </div>
    `;
  }

  private renderSuccess(): string {
    return `
      <div class="import-status import-status-success">
        <div class="import-status-icon">${ICONS.check}</div>
        <p>Layer imported successfully!</p>
      </div>
    `;
  }

  private renderError(): string {
    return `
      <div class="import-status import-status-error">
        <div class="import-status-icon">${ICONS.alert}</div>
        <p>${this.errorMessage}</p>
        <button class="import-btn import-btn-secondary" data-action="retry">
          Try Again
        </button>
      </div>
    `;
  }

  private updateDialog(): void {
    if (!this.overlay) return;
    const dialog = this.overlay.querySelector('.import-dialog');
    if (dialog) {
      dialog.innerHTML = `
        <div class="import-dialog-header">
          <h2>Import GeoJSON</h2>
          <button class="import-dialog-close" data-action="close">
            ${ICONS.close}
          </button>
        </div>

        <div class="import-dialog-body">
          ${this.renderContent()}
        </div>

        <div class="import-dialog-footer">
          <button class="import-btn import-btn-secondary" data-action="close">
            ${this.state === 'success' ? 'Close' : 'Cancel'}
          </button>
          ${this.state === 'idle' ? `
            <button class="import-btn import-btn-primary" data-action="upload" ${this.selectedFile ? '' : 'disabled'}>
              Upload
            </button>
          ` : ''}
        </div>
      `;
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    if (!this.overlay) return;

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Button actions
    this.overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      switch (action) {
        case 'close':
          this.hide();
          break;
        case 'upload':
          this.handleUpload();
          break;
        case 'remove-file':
          this.selectedFile = null;
          this.updateDialog();
          break;
        case 'retry':
          this.state = 'idle';
          this.updateDialog();
          break;
        case 'dropzone':
          this.overlay?.querySelector<HTMLInputElement>('.import-file-input')?.click();
          break;
      }
    });

    // File input change
    const fileInput = this.overlay.querySelector<HTMLInputElement>('.import-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          this.handleFileSelect(file);
        }
      });
    }

    // Drag & drop
    const dropzone = this.overlay.querySelector('.import-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('import-dropzone-active');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('import-dropzone-active');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('import-dropzone-active');
        const file = (e as DragEvent).dataTransfer?.files[0];
        if (file) {
          this.handleFileSelect(file);
        }
      });
    }

    // Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  private handleFileSelect(file: File): void {
    const validation = geoJSONImporter.validateFile(file);
    if (!validation.valid) {
      this.state = 'error';
      this.errorMessage = validation.error || 'Invalid file';
      this.updateDialog();
      return;
    }

    this.selectedFile = file;
    this.updateDialog();
  }

  private async handleUpload(): Promise<void> {
    if (!this.selectedFile) return;

    this.state = 'uploading';
    this.updateDialog();

    const nameInput = this.overlay?.querySelector<HTMLInputElement>('#layer-name');
    const descInput = this.overlay?.querySelector<HTMLTextAreaElement>('#layer-description');

    const result = await geoJSONImporter.import(
      this.selectedFile,
      nameInput?.value || undefined,
      descInput?.value || undefined
    );

    if (result.success) {
      this.state = 'success';
      eventBus.emit('layer:imported', {
        layerId: result.layerId,
        name: result.name,
        featureCount: result.featureCount
      });

      // Auto-close after success
      setTimeout(() => this.hide(), 1500);
    } else {
      this.state = 'error';
      this.errorMessage = result.error || 'Upload failed';
    }

    this.updateDialog();
  }
}

// Singleton instance
export const importDialog = new ImportDialog();
