console.log('Lucashouse website loaded');

// Lightbox Gallery Logic
let currentSlideIndex = 0;
const galleryImages = document.querySelectorAll('.gallery-img');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

// Array to hold image sources
const images = [];

if (galleryImages.length > 0) {
    galleryImages.forEach((img, index) => {
        images.push(img.src);
        img.addEventListener('click', () => {
            openLightbox(index);
        });
    });
}

function openLightbox(index) {
    currentSlideIndex = index;
    lightbox.style.display = 'flex';
    showSlide(currentSlideIndex);
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeLightbox() {
    lightbox.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
}

function changeSlide(n) {
    showSlide(currentSlideIndex += n);
}

function showSlide(n) {
    if (n >= images.length) {
        currentSlideIndex = 0;
    } else if (n < 0) {
        currentSlideIndex = images.length - 1;
    } else {
        currentSlideIndex = n;
    }
    lightboxImg.src = images[currentSlideIndex];
}

// Keyboard controls
document.addEventListener('keydown', function (event) {
    if (lightbox.style.display === 'flex') {
        if (event.key === 'ArrowLeft') {
            changeSlide(-1);
        } else if (event.key === 'ArrowRight') {
            changeSlide(1);
        } else if (event.key === 'Escape') {
            closeLightbox();
        }
    }
});

// Close on background click
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        closeLightbox();
    }
});

// Show More / Show Less Logic
function toggleGallery(galleryId, btn) {
    const gallery = document.getElementById(galleryId);
    gallery.classList.toggle('collapsed');

    if (gallery.classList.contains('collapsed')) {
        btn.textContent = "Mostra di più";
        // gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        btn.textContent = "Mostra di meno";
    }
}

// Check if galleries need the button
function initGalleries() {
    const containers = document.querySelectorAll('.gallery-container');

    containers.forEach(container => {
        const grid = container.querySelector('.gallery-grid');
        const btn = container.querySelector('.show-more-btn');

        if (grid && btn) {
            // Determine state before measurement
            const wasCollapsed = grid.classList.contains('collapsed');

            // Expand to measure full content height
            grid.classList.remove('collapsed');
            const fullHeight = grid.scrollHeight;

            // Re-apply collapsed state for initial check or reset
            grid.classList.add('collapsed');

            // If full height is less than or equal to collapsed max-height (approx 530px), hide button
            if (fullHeight <= 540) {
                btn.style.display = 'none';
                grid.classList.remove('collapsed'); // Content fits, just show it
            } else {
                // Content exceeds limit, button needed
                btn.style.display = 'inline-block';

                // If we are resizing, we want to maintain the "Show More" functionality.
                // Resetting to collapsed ensures the logic "never exceed 2 rows" holds true by default.
                // If user had fully expanded it, re-collapsing on resize might be acceptable or preferred behavior for responsiveness.
                // But for now, we ensure the correct class is present.
                btn.textContent = "Mostra di più";
            }
        }
    });
}

window.addEventListener('load', initGalleries);
window.addEventListener('resize', initGalleries); // Re-check on resize
