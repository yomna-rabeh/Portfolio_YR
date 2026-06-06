import { designWorks, modelsList } from './gallery-data.js';
import { ModelManager, GalleryUIManager } from './models.js';


import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const state = {
    currentFilter: 'all',
    currentLightboxIndex: 0,
    filteredWorks: [...designWorks]
};

function renderGallery() {
    const gallery = document.getElementById('galleryGrid');
    const emptyState = document.getElementById('emptyState');
    state.filteredWorks = state.currentFilter === 'all'
        ? designWorks
        : designWorks.filter((work) => work.category === state.currentFilter);

    gallery.innerHTML = '';

    if (state.filteredWorks.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    state.filteredWorks.forEach((work, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${encodeURI(work.image)}" alt="${work.title}">
            <div class="gallery-overlay"><span>View</span></div>
        `;
        item.addEventListener('click', () => openLightbox(index));
        gallery.appendChild(item);
    });
}

function setupGalleryEvents() {
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach((button) => button.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            renderGallery();
        });
    });

    document.getElementById('lightbox').addEventListener('click', (event) => {
        if (event.target.id === 'lightbox') {
            closeLightbox();
        }
    });

    document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    document.querySelector('.lightbox-prev').addEventListener('click', previousImage);
    document.querySelector('.lightbox-next').addEventListener('click', nextImage);

    document.addEventListener('keydown', (event) => {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox.classList.contains('active')) {
            return;
        }
        if (event.key === 'ArrowLeft') previousImage();
        if (event.key === 'ArrowRight') nextImage();
        if (event.key === 'Escape') closeLightbox();
    });
}

function openLightbox(index) {
    state.currentLightboxIndex = index;
    updateLightbox();
    document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

function updateLightbox() {
    const work = state.filteredWorks[state.currentLightboxIndex];
    document.getElementById('lightboxImage').src = work.image;
    document.getElementById('lightboxCaption').textContent = work.title;
    document.getElementById('lightboxCounter').textContent = `${state.currentLightboxIndex + 1} / ${state.filteredWorks.length}`;
}

function previousImage() {
    state.currentLightboxIndex = (state.currentLightboxIndex - 1 + state.filteredWorks.length) % state.filteredWorks.length;
    updateLightbox();
}

function nextImage() {
    state.currentLightboxIndex = (state.currentLightboxIndex + 1) % state.filteredWorks.length;
    updateLightbox();
}

function initDesignGallery() {
    renderGallery();
    setupGalleryEvents();
}

function initScrollObserver() {
    /*const sections = document.querySelectorAll('.section');
    const options = {
        root: null,
        threshold: 0.1,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observerInstance.unobserve(entry.target);
        });
    }, options);

    sections.forEach((section) => observer.observe(section));*/
    const sections = document.querySelectorAll('.section');
    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observerInstance.unobserve(entry.target);
        });
    }, {
        root: null,
        threshold: 0.05,        // ← lowered from 0.2
        rootMargin: '0px 0px -50px 0px'
    });

    sections.forEach((section) => observer.observe(section));
}

function init3DGallery() {
    const container = document.getElementById('three-container-embedded');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07101a);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(4, 2, 10);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.8, 0);

    const hemi = new THREE.HemisphereLight(0xddeeff, 0x080820, 0.6);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 8, 2);
    dir.castShadow = true;
    scene.add(dir);

    const ambient = new THREE.AmbientLight(0x00ffff, 0.12);
    scene.add(ambient);

    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.9, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const shadowGeo = new THREE.CircleGeometry(1.2, 32);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.35, transparent: true });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.001;
    scene.add(contactShadow);

    const gltfLoader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(draco);

    const modelManager = new ModelManager(scene, gltfLoader);
    const galleryUI = new GalleryUIManager('models-gallery-container');

    modelManager.onLoadStart = (modelData) => {
        galleryUI.setLoading(true);
        galleryUI.updateModelInfo(modelData);
    };
    modelManager.onLoadProgress = (progress) => {
        galleryUI.updateProgress(progress);
    };
    modelManager.onLoadComplete = (modelData) => {
        galleryUI.setLoading(false);
        modelManager.fadeInModel();
        modelManager.animateCamera(camera, controls);
    };
    modelManager.onLoadError = (err, modelData) => {
        galleryUI.setLoading(false);
        console.error(`Failed to load ${modelData.title}`, err);
    };

    galleryUI.onModelSelected = (modelId) => {
        modelManager.loadModelById(modelId);
    };

    galleryUI.renderGallery();
    if (modelsList.length > 0) {
        modelManager.loadModelById(modelsList[0].id);
    }

    const resize = () => {
        const rect = container.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('resize', resize, { passive: true });

    const clock = new THREE.Clock();
    const animate = () => {
        requestAnimationFrame(animate);
        modelManager.updateModelAnimation(clock.getDelta());
        if (modelManager.currentModel) {
            const bob = Math.abs(Math.sin(Date.now() * 0.001)) * 0.02 + 0.98;
            contactShadow.scale.set(bob * 1.1, bob * 1.1, 1);
            contactShadow.material.opacity = THREE.MathUtils.lerp(0.28, 0.45, 1 - bob);
        }
        controls.update();
        renderer.render(scene, camera);
    };

    resize();
    animate();
}

function initPage() {
    initDesignGallery();
    initScrollObserver();
    init3DGallery();
}

document.addEventListener('DOMContentLoaded', initPage);

