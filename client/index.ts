import './style.css';
import { App } from './src/app';

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.start();

    window.addEventListener('beforeunload', () => {
        app.stop();
    });
});

