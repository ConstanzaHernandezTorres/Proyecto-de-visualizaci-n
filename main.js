import './style.css';
import { getSankeyData } from './data.js';
import { renderSankey } from './sankey.js';
import { initAudio } from './audio.js';

document.addEventListener('DOMContentLoaded', () => {
    window.onerror = function(msg, url, line, col, error) {
        document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;">ERROR: ' + msg + '<br>' + (error && error.stack ? error.stack : '') + '</div>';
    };
    window.addEventListener('unhandledrejection', function(event) {
        document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;">PROMISE REJECTION: ' + event.reason + '</div>';
    });
    
    try {
        const data = getSankeyData();
        renderSankey(data);
        
        window.addEventListener('resize', () => {
            renderSankey(data);
        });
    } catch (e) {
        document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;">RENDER ERROR: ' + e.message + '<br>' + e.stack + '</div>';
    }
    
    const startBtn = document.getElementById('start-btn');
    const startOverlay = document.getElementById('start-overlay');
    
    startBtn.addEventListener('click', async () => {
        await initAudio();
        startOverlay.style.opacity = '0';
        setTimeout(() => {
            startOverlay.style.display = 'none';
        }, 500);
    });
});
