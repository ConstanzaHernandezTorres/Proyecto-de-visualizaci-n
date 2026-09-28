import './style.css';
import { getSankeyData } from './data.js';
import { renderSankey } from './sankey.js';
import { initAudio } from './audio.js';
import * as d3 from 'd3';

document.addEventListener('DOMContentLoaded', async () => {
    window.onerror = function(msg, url, line, col, error) {
        document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;">ERROR: ' + msg + '<br>' + (error && error.stack ? error.stack : '') + '</div>';
    };
    window.addEventListener('unhandledrejection', function(event) {
        document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;">PROMISE REJECTION: ' + event.reason + '</div>';
    });
    
    // Create loading state
    const container = document.getElementById('chart-container');
    container.innerHTML = '<div style="color: white; display: flex; align-items: center; justify-content: center; height: 100%; font-size: 1.5rem;">Cargando miles de datos...</div>';
    
    let chartData;
    
    try {
        const rawCSV = await d3.csv('play_tennis_dataset.csv');
        chartData = getSankeyData(rawCSV);
        
        container.innerHTML = '<svg id="sankey-svg"></svg><div id="tooltip" class="tooltip"></div>';
        renderSankey(chartData);
        
        window.addEventListener('resize', () => {
            renderSankey(chartData);
        });
    } catch (e) {
        document.body.innerHTML += '<div style="position:fixed;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;">RENDER ERROR: ' + e.message + '<br>' + e.stack + '</div>';
    }
    
    const startBtn = document.getElementById('start-btn');
    const startOverlay = document.getElementById('start-overlay');
    
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            await initAudio();
            startOverlay.style.opacity = '0';
            setTimeout(() => {
                startOverlay.style.display = 'none';
            }, 500);
        });
    }
});
