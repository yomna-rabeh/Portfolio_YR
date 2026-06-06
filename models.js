/**
 * 3D Model Gallery System
 * Manages model loading, disposal, and scene updates
 * Single renderer, single scene, single canvas - performance optimized
 */

// ============================================
// MODEL DATA STRUCTURE
// ============================================
import * as THREE from 'three';
import { modelsList } from './gallery-data.js';

// ============================================
// MODEL MANAGER CLASS
// ============================================
export class ModelManager {
    constructor(scene, gltfLoader) {
        this.scene = scene;
        this.gltfLoader = gltfLoader;
        this.currentModel = null;
        this.currentModelData = null;
        this.isLoading = false;
        this.loadingProgress = 0;
        this.onLoadStart = null;
        this.onLoadProgress = null;
        this.onLoadComplete = null;
        this.onLoadError = null;
    }

    /**
     * Load a model by ID from the modelsList
     */
    loadModelById(modelId) {
        const modelData = modelsList.find(m => m.id === modelId);
        if (!modelData) {
            console.error(`Model with ID "${modelId}" not found in modelsList`);
            return;
        }
        this.loadModel(modelData);
    }

    /**
     * Load a model from data object
     */
    loadModel(modelData) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.loadingProgress = 0;
        this.currentModelData = modelData;

        // Fire load start event
        if (this.onLoadStart) {
            this.onLoadStart(modelData);
        }

        this.gltfLoader.load(
            modelData.model,
            (gltf) => this.onModelLoaded(gltf, modelData),
            (xhr) => this.onLoadProgressHandler(xhr),
            (err) => this.onLoadErrorHandler(err, modelData)
        );
    }

    /**
     * Handle successful model load
     */
    onModelLoaded(gltf, modelData) {
        // Get the scene from GLTF
        const model = gltf.scene || gltf.scenes[0];
        if (!model) {
            console.error('GLTF loaded but contains no scene.');
            this.isLoading = false;
            return;
        }

        // Remove previous model with fade out
        if (this.currentModel) {
            this.fadeOutModel(() => {
                this.safeRemoveModel();
                this.addNewModel(model);
            });
        } else {
            this.addNewModel(model);
        }
    }

    /**
     * Add new model to scene with setup
     */
    addNewModel(model) {
        // Setup model properties
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Ensure materials are updated
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (m) m.needsUpdate = true;
                    });
                } else if (child.material) {
                    child.material.needsUpdate = true;
                }
            }
        });

        // Auto center and scale
        this.centerAndScaleModel(model);

        // Add to scene
        this.scene.add(model);
        this.currentModel = model;

        // Reset animation state
        this.modelRotationY = 0;

        this.isLoading = false;

        // Fire load complete event
        if (this.onLoadComplete) {
            this.onLoadComplete(this.currentModelData);
        }
    }

    /**
     * Center model using Box3 and scale to fit
     */
    centerAndScaleModel(model) {
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.3 / maxDim;

        // Scale the model
        model.scale.setScalar(scale);

        // Recalculate bounding box after scaling
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());

        // Center horizontally and depth-wise, but keep Y positioning
        model.position.sub(center);

        // Re-calculate for ground placement
        box.setFromObject(model);
        const minY = box.min.y;
        model.position.y -= minY;

        // Update contact shadow scale
        if (this.onModelScaled) {
            this.onModelScaled(box);
        }
    }

    /**
     * Safely remove current model with GPU cleanup
     */
    safeRemoveModel() {
        if (!this.currentModel) return;

        // Remove from scene
        this.scene.remove(this.currentModel);

        // Dispose of materials, geometries, and textures
        this.disposeObject(this.currentModel);

        this.currentModel = null;
    }

    /**
     * Recursively dispose of Three.js objects to prevent memory leaks
     */
    disposeObject(object) {
        object.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => this.disposeMaterial(mat));
                } else {
                    this.disposeMaterial(child.material);
                }
            }
        });
    }

    /**
     * Dispose of material and its textures
     */
    disposeMaterial(material) {
        if (!material) return;

        // Dispose all textures
        ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap'].forEach(prop => {
            if (material[prop]) {
                material[prop].dispose();
            }
        });

        material.dispose();
    }

    /**
     * Fade out animation for current model
     */
    fadeOutModel(callback) {
        if (!this.currentModel) {
            callback();
            return;
        }

        let opacity = 1;
        const fadeInterval = setInterval(() => {
            opacity -= 0.05;
            this.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity = opacity;
                    });
                }
            });

            if (opacity <= 0) {
                clearInterval(fadeInterval);
                callback();
            }
        }, 30);
    }

    /**
     * Fade in animation for new model
     */
    fadeInModel() {
        if (!this.currentModel) return;

        let opacity = 0;
        this.currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    mat.transparent = true;
                    mat.opacity = 0;
                });
            }
        });

        const fadeInterval = setInterval(() => {
            opacity += 0.05;
            this.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        mat.opacity = opacity;
                    });
                }
            });

            if (opacity >= 1) {
                clearInterval(fadeInterval);
                // Reset transparency
                this.currentModel.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            mat.transparent = false;
                        });
                    }
                });
            }
        }, 30);
    }

    /**
     * Handle loading progress
     */
    onLoadProgressHandler(xhr) {
        if (xhr.lengthComputable) {
            this.loadingProgress = (xhr.loaded / xhr.total) * 100;
            if (this.onLoadProgress) {
                this.onLoadProgress(this.loadingProgress);
            }
        }
    }

    /**
     * Handle loading error
     */
    onLoadErrorHandler(err, modelData) {
        console.error(`Error loading model "${modelData.title}":`, err);
        this.isLoading = false;
        if (this.onLoadError) {
            this.onLoadError(err, modelData);
        }
    }

    /**
     * Update model rotation and animation (call each frame)
     */
    updateModelAnimation(deltaTime = 0.016) {
        if (!this.currentModel) return;

        // Gentle rotation
        this.modelRotationY = (this.modelRotationY || 0) + 0.0025;
        this.currentModel.rotation.y = this.modelRotationY;

        // Subtle bob animation
        const bob = Math.abs(Math.sin(Date.now() * 0.001)) * 0.02 + 0.98;
        const originalY = 0; // Adjust if needed
        this.currentModel.position.y = originalY + (1 - bob) * 0.05;
    }

    /**
     * Animate camera to ideal viewing position
     */
    animateCamera(camera, controls, duration = 1000) {
        if (!this.currentModel) return;

        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.5;

        const center = box.getCenter(new THREE.Vector3());
        const newPosition = new THREE.Vector3(
            center.x + cameraDistance * 0.5,
            center.y + maxDim * 0.6,
            center.z + cameraDistance * 0.8
        );

        const startPosition = camera.position.clone();
        const startTime = Date.now();

        const animateFrame = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            camera.position.lerpVectors(startPosition, newPosition, easeProgress);
            controls.target.lerp(center, easeProgress);
            controls.update();

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            }
        };

        animateFrame();
    }
}

// ============================================
// GALLERY UI MANAGER
// ============================================
export class GalleryUIManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.selectedModelId = modelsList[0]?.id || null;
        this.onModelSelected = null;
    }

    /**
     * Render the gallery UI from models list
     */
    renderGallery() {
        if (!this.container) {
            console.error(`Gallery container with ID "${this.container}" not found`);
            return;
        }

        const gallery = document.createElement('div');
        gallery.className = 'models-gallery';

        modelsList.forEach((model) => {
            const card = this.createModelCard(model);
            gallery.appendChild(card);
        });

        this.container.appendChild(gallery);
    }

    /**
     * Create individual model card
     */
    createModelCard(model) {
        const card = document.createElement('div');
        card.className = `model-card ${model.id === this.selectedModelId ? 'active' : ''}`;
        card.dataset.modelId = model.id;

        card.innerHTML = `
            <div class="model-card-image">
                <img src="${model.thumbnail}" alt="${model.title}" />
                <div class="model-card-overlay">
                    <span class="model-card-category">${model.category}</span>
                </div>
            </div>
            <div class="model-card-info">
                <h3 class="model-card-title">${model.title}</h3>
                <!-- <p class="model-card-description">${model.description}</p> -->
            </div>
        `;

        // Ensure thumbnail URL is safe and provide a fallback if the image is missing
        const imgEl = card.querySelector('img');
        if (imgEl) {
            // encode spaces and special chars in the thumbnail path
            imgEl.src = encodeURI(model.thumbnail || '');
            imgEl.onerror = () => {
                imgEl.onerror = null;
                imgEl.src = 'https://via.placeholder.com/200?text=No+Image';
            };
        }

        card.addEventListener('click', () => this.selectModel(model.id));

        return card;
    }

    /**
     * Update selected model and trigger callback
     */
    selectModel(modelId) {
        // Update active state
        document.querySelectorAll('.model-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-model-id="${modelId}"]`)?.classList.add('active');

        this.selectedModelId = modelId;

        // Trigger callback
        if (this.onModelSelected) {
            this.onModelSelected(modelId);
        }
    }

    /**
     * Update model info display
     */
    updateModelInfo(modelData) {
        const infoPanel = document.getElementById('model-info');
        if (!infoPanel) return;

        infoPanel.innerHTML = `
            <h3>${modelData.title}</h3>
            <p>${modelData.description}</p>
            <span class="model-category">${modelData.category}</span>
        `;
    }

    /**
     * Show/hide loading indicator
     */
    setLoading(isLoading) {
        const spinner = document.getElementById('model-loading-spinner');
        const progress = document.getElementById('model-loading-progress');

        if (spinner) {
            spinner.style.display = isLoading ? 'flex' : 'none';
        }
        if (progress) {
            progress.style.display = isLoading ? 'block' : 'none';
        }
    }

    /**
     * Update loading progress
     */
    updateProgress(percentage) {
        const progress = document.getElementById('model-loading-progress');
        if (progress) {
            progress.style.width = percentage + '%';
        }
    }
}
