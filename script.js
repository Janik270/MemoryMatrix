// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Initialize animations when DOM is loaded
document.addEventListener("DOMContentLoaded", (event) => {
    
    // Hero Animation (Load in)
    const heroTl = gsap.timeline();
    
    heroTl.from(".hero-title", {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        delay: 0.2
    })
    .from(".hero-subtitle", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    }, "-=0.6")
    .from(".hero-price", {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    }, "-=0.6")
    .from(".hero-img", {
        y: 100,
        opacity: 0,
        scale: 0.9,
        duration: 1.2,
        ease: "power4.out"
    }, "-=0.4");

    // Scroll Animations for elements fading up
    gsap.utils.toArray('.fade-up').forEach(element => {
        gsap.fromTo(element, 
            { y: 50, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 1,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: element,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                }
            }
        );
    });

    // Scroll Animations for elements fading from left
    gsap.utils.toArray('.fade-left').forEach(element => {
        gsap.fromTo(element, 
            { x: -50, opacity: 0 },
            {
                x: 0,
                opacity: 1,
                duration: 1,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: element,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                }
            }
        );
    });

    // Scroll Animations for elements fading from right
    gsap.utils.toArray('.fade-right').forEach(element => {
        gsap.fromTo(element, 
            { x: 50, opacity: 0 },
            {
                x: 0,
                opacity: 1,
                duration: 1,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: element,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                }
            }
        );
    });

    // Parallax effect on Hero Image
    gsap.to(".hero-img", {
        yPercent: 20,
        ease: "none",
        scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "bottom top",
            scrub: true
        }
    });

    // Smooth hover effect for buy button
    const buyBtn = document.querySelector('.buy-btn');
    if (buyBtn) {
        buyBtn.addEventListener('mouseenter', () => {
            gsap.to(buyBtn, { scale: 1.05, duration: 0.3, ease: "power2.out" });
        });
        buyBtn.addEventListener('mouseleave', () => {
            gsap.to(buyBtn, { scale: 1, duration: 0.3, ease: "power2.out" });
        });
    }

    // 3D Model Viewer Initialization
    const container = document.getElementById('3d-canvas-container');
    if (container && typeof THREE !== 'undefined') {
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 150); // Adjust based on model scale

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        scene.add(directionalLight);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight2.position.set(-100, -100, -50);
        scene.add(directionalLight2);

        // Load STL
        const loader = new THREE.STLLoader();
        // Replace 'model.stl' with the actual path to your STL file
        loader.load('model.stl', function (geometry) {
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x2997ff, 
                specular: 0x111111, 
                shininess: 200 
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Center the model
            geometry.computeBoundingBox();
            const boundingBox = geometry.boundingBox;
            const center = new THREE.Vector3();
            boundingBox.getCenter(center);
            
            mesh.position.sub(center); // Center the geometry

            // Adjust rotation if needed (often STL files are 90 degrees off)
            mesh.rotation.x = -Math.PI / 2;

            // Add the mesh to a pivot group so we rotate around the center
            const pivot = new THREE.Group();
            pivot.add(mesh);
            scene.add(pivot);

            // Auto-adjust camera based on bounding box size
            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5; // zoom out a little
            camera.position.z = cameraZ;

            controls.update();

        }, undefined, function (error) {
            console.error('Fehler beim Laden der STL-Datei:', error);
            container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:rgba(255,255,255,0.7); font-family:Inter,sans-serif; text-align:center; padding: 20px;">STL Datei konnte nicht geladen werden.<br>Bitte platziere eine Datei namens "model.stl" im selben Ordner wie index.html.</div>';
        });

        // Animation Loop
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // Handle Resize
        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    }
});
