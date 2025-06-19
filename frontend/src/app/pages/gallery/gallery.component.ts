import { Component, OnInit } from '@angular/core';
import { ImageService, ImageListResponse } from '../../services/image.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})


export class GalleryComponent implements OnInit {
  images: { key: string; url: string }[] = [];
  nextToken?: string;
  prevTokens: string[] = [];
  loading = false;
  error = '';
  selectedFile?: File;
  uploadedUrl = '';
  displayImageUrl: string | null = null;


  constructor(private readonly imageService: ImageService) {}

  ngOnInit() {
    this.loadPage();
  }

  // Load images (first page or with token)
  async loadPage(token?: string) {
    this.loading = true;
    this.error = '';
    try {
      // track prev tokens for “Back”
      if (token && this.nextToken) {
        this.prevTokens.push(this.nextToken);
      } else if (!token) {
        this.prevTokens = [];
      }
      const resp: ImageListResponse = await this.imageService.listImages(token);
      this.images = resp.images;
      this.nextToken = resp.nextToken;
    } catch (err: any) {
      this.error = err.message ?? 'Failed to load images';
    } finally {
      this.loading = false;
    }
  }

  // Go forward
  next() {
    if (this.nextToken) this.loadPage(this.nextToken);
  }
  // Go back
  back() {
    const prev = this.prevTokens.pop();
    this.loadPage(prev);
  }

  // File selection
  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  // Upload then refresh
  async upload() {
    if (!this.selectedFile) return;
    this.loading = true;
    this.error = '';
    try {
      this.uploadedUrl = await this.imageService.uploadImage(this.selectedFile);
      this.selectedFile = undefined;
      // after upload, reload first page
      this.displayImageUrl = this.uploadedUrl;
      this.loadPage();
    } catch (err: any) {
      this.error = err.message ?? 'Upload failed';
    } finally {
      this.loading = false;
    }
  }

  // Delete an image
  async delete(key: string) {
    if (!confirm('Delete this image?')) return;
    this.loading = true;
    try {
      await this.imageService.deleteImage(key);
      this.loadPage();  // refresh
    } catch (err: any) {
      this.error = err.message ?? 'Delete failed';
    } finally {
      this.loading = false;
    }
  }

  viewImage(url: string) {
    this.displayImageUrl = url;
  }
}

