import { Component, computed, ElementRef, OnInit, signal, viewChild } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { CommonModule } from '@angular/common';
import { image, ImageListResponse } from '../../types/image.types';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})


export class GalleryComponent implements OnInit {
  images=signal<image[]>([]); 
  nextToken?: string;
  prevTokens: string[] = [];
  loading = false;
  error = '';
  selectedFile=signal<File | undefined>(undefined);
  uploadedUrl = '';
  displayImageUrl: string | null = null;
  selectedImageUrl: string  = '';

  galleryForm = viewChild<ElementRef<HTMLFormElement>>('fileForm');


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
      this.images.set(resp.images);
      this.nextToken = resp.nextToken;
      this.clearImageDescription();
      this.resetInputForm(); // Reset form after loading images
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

  showPreviewWindow = computed(()=>this.images().length || !this.images().length && this.selectedFile());

  // File selection
  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile.set(input.files[0]);
      this.selectedImageUrl= URL.createObjectURL(this.selectedFile()!);
      this.displayImageUrl = this.selectedImageUrl; // Show selected image
    }
  }

  // Upload then refresh
  async upload() {
    if (!this.selectedFile) return;
    this.loading = true;
    this.error = '';
    try {
      this.uploadedUrl = await this.imageService.uploadImage(this.selectedFile()!);
      this.selectedFile.set(undefined) ;
      // after upload, reload first page
      this.selectedImageUrl = this.uploadedUrl.substring(8); // Remove 'upload/'
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
      this.clearImageDescription();
      this.loadPage();  // refresh
    } catch (err: any) {
      this.error = err.message ?? 'Delete failed';
    } finally {
      this.loading = false;
    }
  }

  viewImage(url:image) {
    this.displayImageUrl = url.url;
    this.selectedImageUrl = url.key.substring(8); // Remove 'upload/' prefix
  }

  clearImageDescription() {
    this.displayImageUrl = null;
    this.selectedImageUrl = "";
    this.uploadedUrl = '';
  }

  resetInputForm() {
    this.galleryForm()?.nativeElement.reset();
    this.selectedFile.set(undefined);
    this.displayImageUrl = null;
    this.selectedImageUrl = '';
  }
}

