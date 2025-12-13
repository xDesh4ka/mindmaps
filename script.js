// ============================================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================
const state = {
    nodes: [],
    connections: [],
    selectedNodes: [],
    camera: { x: 0, y: 0, zoom: 1 },
    isDragging: false,
    isPanning: false,
    dragStart: null,
    editingNode: null,
    hoveredNode: null,
    clipboard: [],
    history: [],
    historyIndex: -1,
    nodeIdCounter: 0,
    hoveredNodeTimeout: null,
    clipboardConnections: []
};

// ============================================================
// КОНФИГУРАЦИЯ И КОНСТАНТЫ
// ============================================================
const CONFIG = {
    NODE_WIDTH: 180,
    NODE_HEIGHT: 60,
    NODE_PADDING: 12,
    NODE_RADIUS: 16,
    LINE_WIDTH: 2,
    FONT_SIZE: 14,
    FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    MIN_ZOOM: 0.3,
    MAX_ZOOM: 3,
    ZOOM_STEP: 0.05,
    PAN_SPEED: 20,
    COLLAPSED_HEIGHT: 40,
    COLORS: ['#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF3E0', '#FCE4EC', '#E0F2F1', '#F1F8E9', '#FFF9C4'],
    HOVER_DELAY: 300
};

// ============================================================
// ИНИЦИАЛИЗАЦИЯ CANVAS
// ============================================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ============================================================
// КЛАССЫ: NODE (УЗЕЛ)
// ============================================================
class Node {
    constructor(x, y, text = 'Новый узел', color = CONFIG.COLORS[0]) {
        this.id = state.nodeIdCounter++;
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.width = CONFIG.NODE_WIDTH;
        this.height = CONFIG.NODE_HEIGHT;
        this.isCollapsed = false;
        this.children = [];
        this.parent = null;
    }

    // Проверка попадания точки в узел
    containsPoint(x, y) {
        const height = this.isCollapsed ? CONFIG.COLLAPSED_HEIGHT : this.height;
        return x >= this.x - this.width/2 && 
                x <= this.x + this.width/2 &&
                y >= this.y - height/2 && 
                y <= this.y + height/2;
    }

    // Отрисовка узла
    draw(ctx, isSelected, isHovered) {
        if (!this.isCollapsed) {
            this.updateHeight(ctx);
        }
        const height = this.isCollapsed ? CONFIG.COLLAPSED_HEIGHT : this.height;

        ctx.save();

        // Тень для выделенного узла
        if (isSelected) {
            ctx.shadowColor = 'rgba(0, 123, 255, 0.5)';
            ctx.shadowBlur = 10;
        }

        // Рисуем прямоугольник со скругленными углами
        this.drawRoundedRect(ctx, 
            this.x - this.width/2, 
            this.y - height/2, 
            this.width, 
            height, 
            CONFIG.NODE_RADIUS
        );

        // Заливка
        ctx.fillStyle = this.color;
        ctx.fill();

        // Обводка
        ctx.strokeStyle = isSelected ? '#007bff' : '#ddd';
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();

        ctx.restore();

        // Текст
        this.drawText(ctx, height);

        // Кнопки при наведении
        if (isHovered && !state.editingNode) {
            this.drawHoverButtons(ctx);
        }
    }

    // Рисование скругленного прямоугольника
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // Рисование текста с переносом строк
    drawText(ctx, height) {
        ctx.fillStyle = '#333';
        ctx.font = `${CONFIG.FONT_SIZE}px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lines = this.wrapText(ctx, this.text, this.width - CONFIG.NODE_PADDING * 2);
        const displayLines = this.isCollapsed ? [lines[0]] : lines;
        
        const lineHeight = CONFIG.FONT_SIZE + 4;
        const totalHeight = displayLines.length * lineHeight;
        const startY = this.y - totalHeight/2 + lineHeight/2;
        
        displayLines.forEach((line, i) => {
            ctx.fillText(line, this.x, startY + i * lineHeight);
        });
        
        if (this.isCollapsed && lines.length > 1) {
            ctx.fillStyle = '#007bff';
            ctx.font = `12px ${CONFIG.FONT_FAMILY}`;
            const indicatorY = this.y + height/2 - 10;
            ctx.fillText(`...`, 
                        this.x, indicatorY);
        }
    }


    // Перенос текста по словам
    wrapText(ctx, text, maxWidth) {
        const paragraphs = text.split('\n');  // Разделяем по переносам
        const lines = [];
        
        paragraphs.forEach(paragraph => {
            if (!paragraph) {
                lines.push('');
                return;
            }
            
            const words = paragraph.split(' ');
            let currentLine = '';

            words.forEach(word => {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            
            if (currentLine) lines.push(currentLine);
        });
        
        return lines.length > 0 ? lines : [''];
    }

    // Кнопки при наведении
    drawHoverButtons(ctx) {
        // Кнопка добавления дочернего узла
        const btnX = this.x + this.width/2 + 15;
        const btnY = this.y;

        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, btnX - 14, btnY - 14, 28, 28, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#007bff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('→', btnX, btnY);

        // Сохраняем координаты кнопки для обработки кликов
        this.addChildBtnBounds = { x: btnX - 14, y: btnY - 14, width: 28, height: 28 };

        // Палитра цветов
        this.drawColorPalette(ctx);
    }

    // Палитра цветов
    drawColorPalette(ctx) {
        const paletteX = this.x-(CONFIG.NODE_WIDTH/2);
        const paletteY = this.y+(CONFIG.NODE_HEIGHT/2);
        // const paletteX = this.x - this.width/2 - 200;
        // const paletteY = this.y - 20;
        const colorSize = 16;
        const gap = 6;
        const padding = 8;

        const paletteWidth = CONFIG.COLORS.length * (colorSize + gap) - gap + padding * 2;
        const paletteHeight = colorSize + padding * 2;

        // Фон палитры
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, paletteX, paletteY, paletteWidth, paletteHeight, 8);
        ctx.fill();
        ctx.stroke();

        // Цвета
        this.colorPaletteBounds = [];
        CONFIG.COLORS.forEach((color, i) => {
            const x = paletteX + padding + i * (colorSize + gap);
            const y = paletteY + padding;

            ctx.fillStyle = color;
            ctx.strokeStyle = this.color === color ? '#333' : '#ccc';
            ctx.lineWidth = this.color === color ? 2 : 1;
            this.drawRoundedRect(ctx, x, y, colorSize, colorSize, 4);
            ctx.fill();
            ctx.stroke();

            this.colorPaletteBounds.push({ x, y, width: colorSize, height: colorSize, color });
        });
    }
    

    // Обновление высоты узла в зависимости от текста
    updateHeight(ctx) {
        ctx.font = `${CONFIG.FONT_SIZE}px ${CONFIG.FONT_FAMILY}`;
        const lines = this.wrapText(ctx, this.text, this.width - CONFIG.NODE_PADDING * 2);
        const lineHeight = CONFIG.FONT_SIZE + 4;
        
        const textHeight = lines.length * lineHeight;
        this.height = Math.max(
            CONFIG.NODE_HEIGHT, 
            textHeight + CONFIG.NODE_PADDING * 3  // Больше отступов
        );
    }
}

// ============================================================
// КЛАСС: CONNECTION (СВЯЗЬ)
// ============================================================
/*
class Connection {
    constructor(fromNode, toNode) {
    this.from = fromNode;
    this.to = toNode;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.from.x, this.from.y);
        ctx.lineTo(this.to.x, this.to.y);
        
        ctx.strokeStyle = '#999';
        ctx.lineWidth = CONFIG.LINE_WIDTH;
        ctx.stroke();
        
        this.drawArrow(ctx, this.from.x, this.from.y, this.to.x, this.to.y);
    }

    drawArrow(ctx, fromX, fromY, toX, toY) {
        const arrowSize = 10;
        
        // Угол линии
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        // Позиция стрелки на границе узла
        const nodeHeight = this.to.isCollapsed ? CONFIG.COLLAPSED_HEIGHT : this.to.height;
        const offset = Math.max(this.to.width, nodeHeight) / 2;
        const arrowX = toX - Math.cos(angle) * offset;
        const arrowY = toY - Math.sin(angle) * offset;
        
        // Рисуем треугольник
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowSize, -arrowSize / 2);
        ctx.lineTo(-arrowSize, arrowSize / 2);
        ctx.closePath();
        
        ctx.fillStyle = '#999';
        ctx.fill();
        
        ctx.restore();
    }

    // Проверка близости точки к линии (для удаления)
    isNearPoint(x, y, threshold = 10) {
        const dist = this.distanceToLine(x, y, this.from.x, this.from.y, this.to.x, this.to.y);
        return dist < threshold;
    }

    distanceToLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
*/
class Connection {
    constructor(fromNode, toNode) {
        this.from = fromNode;
        this.to = toNode;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.from.x, this.from.y);
        ctx.lineTo(this.to.x, this.to.y);
        
        ctx.strokeStyle = '#999';
        ctx.lineWidth = CONFIG.LINE_WIDTH;
        ctx.stroke();
        
        this.drawArrow(ctx, this.from.x, this.from.y, this.to.x, this.to.y);
    }

    getRectangleEdgePoint(centerX, centerY, width, height, angle) {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        // Расстояние до вертикальных и горизонтальных границ
        const tx = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity;
        const ty = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity;
        
        // Берем минимальное (ближайшее пересечение)
        const t = Math.min(tx, ty);
        
        return {
            x: centerX - dx * t,
            y: centerY - dy * t
        };
    }

    drawArrow(ctx, fromX, fromY, toX, toY) {
        const arrowSize = 10;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        // Получаем точную точку на границе узла
        const nodeHeight = this.to.isCollapsed ? CONFIG.COLLAPSED_HEIGHT : this.to.height;
        const edgePoint = this.getRectangleEdgePoint(
            toX, toY, 
            this.to.width, 
            nodeHeight, 
            angle
        );
        
        // Рисуем стрелку точно на границе
        ctx.save();
        ctx.translate(edgePoint.x, edgePoint.y);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowSize, -arrowSize / 2);
        ctx.lineTo(-arrowSize, arrowSize / 2);
        ctx.closePath();
        
        ctx.fillStyle = '#999';
        ctx.fill();
        
        ctx.restore();
    }
    
    isNearPoint(x, y, threshold = 10) {
        const dist = this.distanceToLine(x, y, this.from.x, this.from.y, this.to.x, this.to.y);
        return dist < threshold;
    }

    distanceToLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}


// ============================================================
// УТИЛИТЫ: Создание новой карты
// ============================================================
function newMap() {
    // if (!confirm('Создать новую карту?')) {
        // return;
    // }
    
    // Очищаем состояние
    state.nodes = [];
    state.connections = [];
    state.selectedNodes = [];
    state.editingNode = null;
    state.clipboard = [];
    state.history = [];
    state.historyIndex = -1;
    state.camera = { x: 0, y: 0, zoom: 1 };
    
    // Создаем начальные узлы
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    const root = createNode(cx, cy, 'Mind Map Editor', CONFIG.COLORS[0]);
    const c1 = createNode(cx - 200, cy, 'Идея 1', CONFIG.COLORS[1]);
    const c2 = createNode(cx + 200, cy, 'Идея 2', CONFIG.COLORS[2]);
    
    root.children = [c1, c2];
    c1.parent = root;
    c2.parent = root;
    
    state.connections.push(new Connection(root, c1));
    state.connections.push(new Connection(root, c2));
    
    saveHistory();
    render();
}


// ============================================================
// УТИЛИТЫ: LOCAL STORAGE
// ============================================================
// Сохранение в localStorage
function saveToLocalStorage() {
    try {
        const data = {
            nodes: state.nodes.map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                text: n.text,
                color: n.color,
                width: n.width,
                height: n.height,
                isCollapsed: n.isCollapsed || false,
                children: n.children.map(c => c.id),
                parent: n.parent ? n.parent.id : null
            })),
            connections: state.connections.map(c => ({
                from: c.from.id,
                to: c.to.id
            })),
            camera: {
                x: state.camera.x,
                y: state.camera.y,
                zoom: state.camera.zoom
            }
        };
        
        localStorage.setItem('mindmap_data', JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        return false;
    }
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('mindmap_data');
        if (!savedData) return false;
        
        const data = JSON.parse(savedData);
        state.nodes = [];
        state.connections = [];
        
        const nodeMap = new Map();
        
        // Создаем узлы
        data.nodes.forEach(nd => {
            const node = new Node(nd.x, nd.y, nd.text, nd.color);
            node.id = nd.id;
            node.width = nd.width;
            node.height = nd.height;
            node.isCollapsed = nd.isCollapsed;
            state.nodes.push(node);
            nodeMap.set(node.id, node);
        });
        
        // Восстанавливаем связи
        data.nodes.forEach(nd => {
            const node = nodeMap.get(nd.id);
            if (nd.parent) node.parent = nodeMap.get(nd.parent);
            node.children = nd.children.map(id => nodeMap.get(id)).filter(Boolean);
        });
        
        // Создаем connections
        data.connections.forEach(cd => {
            const from = nodeMap.get(cd.from);
            const to = nodeMap.get(cd.to);
            if (from && to) state.connections.push(new Connection(from, to));
        });
        
        // Восстанавливаем камеру
        if (data.camera) {
            state.camera.x = data.camera.x;
            state.camera.y = data.camera.y;
            state.camera.zoom = data.camera.zoom;
        }
        
        render();
        return true;
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        return false;
    }
}


// ============================================================
// УТИЛИТЫ: ПРЕОБРАЗОВАНИЕ КООРДИНАТ
// ============================================================
function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - state.camera.x) / state.camera.zoom,
        y: (screenY - state.camera.y) / state.camera.zoom
    };
}

function worldToScreen(worldX, worldY) {
    return {
        x: worldX * state.camera.zoom + state.camera.x,
        y: worldY * state.camera.zoom + state.camera.y
    };
}

// ============================================================
// УТИЛИТЫ: ИСТОРИЯ ДЕЙСТВИЙ (UNDO/REDO)
// ============================================================
function saveHistory() {
    // Удаляем все действия после текущего индекса
    state.history = state.history.slice(0, state.historyIndex + 1);

    // Сохраняем текущее состояние
    state.history.push({
        nodes: JSON.parse(JSON.stringify(state.nodes.map(n => ({
            id: n.id, x: n.x, y: n.y, text: n.text, color: n.color, 
            width: n.width, height: n.height, children: n.children.map(c => c.id),
            parent: n.parent ? n.parent.id : null
        })))),
        connections: state.connections.map(c => ({ from: c.from.id, to: c.to.id }))
    });

    state.historyIndex++;

    // Ограничиваем размер истории
    if (state.history.length > 50) {
        state.history.shift();
        state.historyIndex--;
    }
    // Автосохранение (пока не надо)
    //saveToLocalStorage();
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        restoreFromHistory();
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        restoreFromHistory();
    }
}

function restoreFromHistory() {
    const snapshot = state.history[state.historyIndex];

    // Восстанавливаем узлы
    state.nodes = snapshot.nodes.map(n => {
        const node = new Node(n.x, n.y, n.text, n.color);
        node.id = n.id;
        node.width = n.width;
        node.height = n.height;
        return node;
    });

    // Восстанавливаем связи parent/children
    snapshot.nodes.forEach((n, i) => {
        if (n.parent !== null) {
            state.nodes[i].parent = state.nodes.find(node => node.id === n.parent);
        }
        state.nodes[i].children = n.children.map(cid => state.nodes.find(node => node.id === cid));
    });

    // Восстанавливаем connections
    state.connections = snapshot.connections.map(c => {
        const from = state.nodes.find(n => n.id === c.from);
        const to = state.nodes.find(n => n.id === c.to);
        return new Connection(from, to);
    });

    state.nodeIdCounter = Math.max(...state.nodes.map(n => n.id), 0) + 1;
    render();
}

// ============================================================
// ФУНКЦИИ: РАБОТА С УЗЛАМИ
// ============================================================
function createNode(x, y, text, color) {
    const node = new Node(x, y, text, color);
    state.nodes.push(node);
    saveHistory();
    return node;
}

function deleteNode(node) {
    // Удаляем все связи с этим узлом
    state.connections = state.connections.filter(c => c.from !== node && c.to !== node);

    // Удаляем из children родителя
    if (node.parent) {
        node.parent.children = node.parent.children.filter(c => c !== node);
    }

    // Удаляем дочерние узлы рекурсивно
    [...node.children].forEach(child => deleteNode(child));

    // Удаляем узел
    state.nodes = state.nodes.filter(n => n !== node);
    state.selectedNodes = state.selectedNodes.filter(n => n !== node);

    saveHistory();
}

function addChildNode(parentNode) {
    const childX = parentNode.x + 250;
    const childY = parentNode.y + parentNode.children.length * 100;

    const childNode = createNode(childX, childY, 'Дочерний узел', CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)]);

    parentNode.children.push(childNode);
    childNode.parent = parentNode;

    const connection = new Connection(parentNode, childNode);
    state.connections.push(connection);

    saveHistory();
    render();
}

function getNodeAt(x, y) {
    // Проверяем узлы в обратном порядке (сверху вниз)
    for (let i = state.nodes.length - 1; i >= 0; i--) {
        if (state.nodes[i].containsPoint(x, y)) {
            return state.nodes[i];
        }
    }
    return null;
}

// ============================================================
// ФУНКЦИИ: РЕДАКТИРОВАНИЕ ТЕКСТА
// ============================================================
function startEditingNode(node) {
    if (node.isCollapsed) {
        node.isCollapsed = false;
    }
    state.editingNode = node;
    document.getElementById('editingIndicator').classList.add('active');
    render();
}

function stopEditingNode() {
    if (state.editingNode) {
        state.editingNode.updateHeight(ctx);
        state.editingNode = null;
        document.getElementById('editingIndicator').classList.remove('active');
        saveHistory();
        render();
    }
}

// ============================================================
// ФУНКЦИИ: МАСШТАБИРОВАНИЕ И НАВИГАЦИЯ
// ============================================================
function zoom(delta, centerX = canvas.width / 2, centerY = canvas.height / 2) {
    const oldZoom = state.camera.zoom;
    state.camera.zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, state.camera.zoom + delta));

    // Масштабирование относительно центра
    const zoomRatio = state.camera.zoom / oldZoom;
    state.camera.x = centerX - (centerX - state.camera.x) * zoomRatio;
    state.camera.y = centerY - (centerY - state.camera.y) * zoomRatio;

    render();
}

function resetZoom() {
    state.camera.zoom = 1;
    render();
}

function centerView() {
    const nodesToCenter = state.selectedNodes.length > 0 ? state.selectedNodes : state.nodes;

    if (nodesToCenter.length === 0) {
        state.camera.x = canvas.width / 2;
        state.camera.y = canvas.height / 2;
        render();
        return;
    }

    // Находим центр масс выбранных узлов
    let sumX = 0, sumY = 0;
    nodesToCenter.forEach(node => {
        sumX += node.x;
        sumY += node.y;
    });

    const centerX = sumX / nodesToCenter.length;
    const centerY = sumY / nodesToCenter.length;

    const screenCenter = worldToScreen(centerX, centerY);
    state.camera.x += canvas.width / 2 - screenCenter.x;
    state.camera.y += canvas.height / 2 - screenCenter.y;

    render();
}

function panCamera(dx, dy) {
    state.camera.x += dx;
    state.camera.y += dy;
    render();
}

// ============================================================
// ФУНКЦИИ: АВТОРАСКЛАДКА
// ============================================================
function autoLayout() {
    if (state.nodes.length === 0) return;

    // Простой алгоритм: располагаем узлы по уровням
    const levels = {};
    const visited = new Set();

    // Находим корневые узлы (без родителей)
    const roots = state.nodes.filter(n => !n.parent);

    function assignLevel(node, level) {
        if (visited.has(node.id)) return;
        visited.add(node.id);

        if (!levels[level]) levels[level] = [];
        levels[level].push(node);

        node.children.forEach(child => assignLevel(child, level + 1));
    }

    roots.forEach(root => assignLevel(root, 0));

    // Располагаем узлы
    const levelKeys = Object.keys(levels).sort((a, b) => a - b);
    const startX = 100;
    const startY = 100;
    const horizontalGap = 300;
    const verticalGap = 150;

    levelKeys.forEach((level, levelIndex) => {
        const nodesInLevel = levels[level];
        nodesInLevel.forEach((node, nodeIndex) => {
            node.x = startX + levelIndex * horizontalGap;
            node.y = startY + nodeIndex * verticalGap;
        });
    });

    saveHistory();
    render();
}

// ============================================================
// ФУНКЦИИ: КОПИРОВАНИЕ И ВСТАВКА
// ============================================================
/*
function copySelectedNodes() {
    if (state.selectedNodes.length === 0) return;

    state.clipboard = state.selectedNodes.map(node => ({
        text: node.text,
        color: node.color,
        width: node.width,
        height: node.height
    }));
}
*/
function copySelectedNodes() {
    if (state.selectedNodes.length === 0) return;
    
    // Копируем узлы
    state.clipboard = state.selectedNodes.map(node => ({
        text: node.text,
        color: node.color,
        width: node.width,
        height: node.height,
        isCollapsed: node.isCollapsed || false,
        originalNode: node  // Сохраняем ссылку на оригинал
    }));
    
    state.clipboardConnections = [];
    
    state.connections.forEach(conn => {
        const fromIndex = state.selectedNodes.indexOf(conn.from);
        const toIndex = state.selectedNodes.indexOf(conn.to);
        
        // Если оба узла связи выделены - сохраняем связь
        if (fromIndex !== -1 && toIndex !== -1) {
            state.clipboardConnections.push({
                fromIndex: fromIndex,
                toIndex: toIndex
            });
        }
    });
}

/*
function pasteNodes() {
    if (state.clipboard.length === 0) return;

    state.selectedNodes = [];

    state.clipboard.forEach((nodeData, i) => {
        const node = createNode(
            canvas.width / 2 / state.camera.zoom + i * 50,
            canvas.height / 2 / state.camera.zoom + i * 50,
            nodeData.text,
            nodeData.color
        );
        node.width = nodeData.width;
        node.height = nodeData.height;
        state.selectedNodes.push(node);
    });

    render();
}
*/
function pasteNodes() {
    if (state.clipboard.length === 0) return;
    
    const offset = 50;
    const newNodes = [];
    
    // Создаем новые узлы
    state.clipboard.forEach(clipNode => {
        let baseX, baseY;
        
        if (state.selectedNodes.length > 0) {
            baseX = state.selectedNodes[0].x;
            baseY = state.selectedNodes[0].y;
        } else if (clipNode.originalNode) {
            baseX = clipNode.originalNode.x;
            baseY = clipNode.originalNode.y;
        } else {
            baseX = canvas.width / 2;
            baseY = canvas.height / 2;
        }
        
        const newNode = createNode(
            baseX + offset,
            baseY + offset,
            clipNode.text,
            clipNode.color
        );
        
        newNode.width = clipNode.width;
        newNode.height = clipNode.height;
        newNode.isCollapsed = clipNode.isCollapsed;
        
        newNodes.push(newNode);
    });
    
    if (state.clipboardConnections) {
        state.clipboardConnections.forEach(connData => {
            const fromNode = newNodes[connData.fromIndex];
            const toNode = newNodes[connData.toIndex];
            
            if (fromNode && toNode) {
                // Создаем связь
                state.connections.push(new Connection(fromNode, toNode));
                
                // Устанавливаем parent/children
                toNode.parent = fromNode;
                if (!fromNode.children.includes(toNode)) {
                    fromNode.children.push(toNode);
                }
            }
        });
    }
    
    // Выделяем вставленные узлы
    state.selectedNodes = newNodes;
    
    saveHistory();
    render();
}

function cutNodes() {
    if (state.selectedNodes.length === 0) return;
    
    // Копируем выделенные узлы в буфер (как при Ctrl+C)
    copySelectedNodes();
    
    // Удаляем выделенные узлы
    state.selectedNodes.forEach(node => {
        // Удаляем связи
        state.connections = state.connections.filter(conn => 
            conn.from !== node && conn.to !== node
        );
        
        // Удаляем из parent.children
        if (node.parent) {
            node.parent.children = node.parent.children.filter(c => c !== node);
        }
        
        // Удаляем узел
        state.nodes = state.nodes.filter(n => n !== node);
    });
    
    state.selectedNodes = [];
    saveHistory();
    render();
}

// ============================================================
// ФУНКЦИИ: ЭКСПОРТ И ИМПОРТ
// ============================================================
function exportToPNG() {
    // Создаем временный canvas со всей картой
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Находим границы карты
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(node => {
        minX = Math.min(minX, node.x - node.width/2);
        minY = Math.min(minY, node.y - node.height/2);
        maxX = Math.max(maxX, node.x + node.width/2);
        maxY = Math.max(maxY, node.y + node.height/2);
    });

    const padding = 50;
    tempCanvas.width = maxX - minX + padding * 2;
    tempCanvas.height = maxY - minY + padding * 2;

    // Белый фон
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Смещаем систему координат
    tempCtx.translate(-minX + padding, -minY + padding);

    // Рисуем связи
    state.connections.forEach(conn => conn.draw(tempCtx));

    // Рисуем узлы
    state.nodes.forEach(node => node.draw(tempCtx, false, false));

    // Скачиваем
    const link = document.createElement('a');
    link.download = 'mindmap.png';
    link.href = tempCanvas.toDataURL();
    link.click();
}

function exportToJSON() {
    const data = {
        nodes: state.nodes.map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            text: n.text,
            color: n.color,
            width: n.width,
            height: n.height,
            children: n.children.map(c => c.id),
            parent: n.parent ? n.parent.id : null
        })),
        connections: state.connections.map(c => ({
            from: c.from.id,
            to: c.to.id
        }))
    };

    const json = JSON.stringify(data, null, 2);
    document.getElementById('jsonOutput').value = json;

    // Скачиваем
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'mindmap.json';
    link.href = URL.createObjectURL(blob);
    link.click();
}

function importFromJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);

        // Очищаем текущее состояние
        state.nodes = [];
        state.connections = [];
        state.selectedNodes = [];

        // Создаем узлы
        data.nodes.forEach(n => {
            const node = new Node(n.x, n.y, n.text, n.color);
            node.id = n.id;
            node.width = n.width;
            node.height = n.height;
            state.nodes.push(node);
        });

        // Восстанавливаем связи parent/children
        data.nodes.forEach((n, i) => {
            if (n.parent !== null) {
                state.nodes[i].parent = state.nodes.find(node => node.id === n.parent);
            }
            state.nodes[i].children = n.children.map(cid => state.nodes.find(node => node.id === cid));
        });

        // Создаем connections
        data.connections.forEach(c => {
            const from = state.nodes.find(n => n.id === c.from);
            const to = state.nodes.find(n => n.id === c.to);
            if (from && to) {
                state.connections.push(new Connection(from, to));
            }
        });

        state.nodeIdCounter = Math.max(...state.nodes.map(n => n.id), 0) + 1;
        saveHistory();
        render();

        return true;
    } catch (e) {
        alert('Ошибка импорта: ' + e.message);
        return false;
    }
}

// ============================================================
// ФУНКЦИЯ: ОТРИСОВКА
// ============================================================
function render() {
    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Применяем трансформации камеры
    ctx.translate(state.camera.x, state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);

    // Рисуем связи
    state.connections.forEach(conn => conn.draw(ctx));

    // Рисуем узлы
    state.nodes.forEach(node => {
        const isSelected = state.selectedNodes.includes(node);
        const isHovered = state.hoveredNode === node;
        node.draw(ctx, isSelected, isHovered);
    });

    ctx.restore();
}

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ МЫШИ
// ============================================================
canvas.addEventListener('mousedown', (e) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    if (state.editingNode) {
        stopEditingNode();
    }
    
    // ✅ СНАЧАЛА проверяем UI элементы (палитра и кнопки)
    for (const node of state.nodes) {
        // Проверяем палитру цветов
        if (node.colorPaletteBounds && state.hoveredNode === node) {
            for (const colorBound of node.colorPaletteBounds) {
                if (worldPos.x >= colorBound.x && 
                    worldPos.x <= colorBound.x + colorBound.width &&
                    worldPos.y >= colorBound.y && 
                    worldPos.y <= colorBound.y + colorBound.height) {
                    node.color = colorBound.color;
                    saveHistory();
                    render();
                    return;
                }
            }
        }
        
        // Проверяем кнопку добавления дочернего узла
        if (node.addChildBtnBounds && state.hoveredNode === node) {
            const bounds = node.addChildBtnBounds;
            if (worldPos.x >= bounds.x && 
                worldPos.x <= bounds.x + bounds.width &&
                worldPos.y >= bounds.y && 
                worldPos.y <= bounds.y + bounds.height) {
                addChildNode(node);
                return;
            }
        }
    }
    
    const clickedNode = getNodeAt(worldPos.x, worldPos.y);
    
    if (clickedNode) {
        // Выделение узла
        if (!e.shiftKey && !state.selectedNodes.includes(clickedNode)) {
            state.selectedNodes = [clickedNode];
        } else if (e.shiftKey) {
            if (state.selectedNodes.includes(clickedNode)) {
                state.selectedNodes = state.selectedNodes.filter(n => n !== clickedNode);
            } else {
                state.selectedNodes.push(clickedNode);
            }
        }
        
        state.isDragging = true;
        state.dragStart = { x: worldPos.x, y: worldPos.y };
        render();
    } else {
        // Проверяем клик по связи (Shift + клик для удаления)
        if (e.shiftKey) {
            for (let i = state.connections.length - 1; i >= 0; i--) {
                if (state.connections[i].isNearPoint(worldPos.x, worldPos.y)) {
                    const conn = state.connections[i];
                    if (conn.to.parent === conn.from) {
                        conn.to.parent = null;
                        conn.from.children = conn.from.children.filter(c => c !== conn.to);
                    }
                    state.connections.splice(i, 1);
                    saveHistory();
                    render();
                    return;
                }
            }
        }
        
        state.selectedNodes = [];
        state.isPanning = true;
        state.dragStart = { x: e.clientX, y: e.clientY };
        render();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    if (state.isDragging && state.selectedNodes.length > 0) {
        const dx = worldPos.x - state.dragStart.x;
        const dy = worldPos.y - state.dragStart.y;

        state.selectedNodes.forEach(node => {
            node.x += dx;
            node.y += dy;
        });

        state.dragStart = worldPos;
        render();
    } else if (state.isPanning) {
        const dx = e.clientX - state.dragStart.x;
        const dy = e.clientY - state.dragStart.y;

        state.camera.x += dx;
        state.camera.y += dy;

        state.dragStart = { x: e.clientX, y: e.clientY };
        render();
    } else {
        // Проверяем наведение для показа кнопок
        const hoveredNode = getNodeAt(worldPos.x, worldPos.y);
        
        // Очищаем предыдущий таймер
        if (state.hoveredNodeTimeout) {
            clearTimeout(state.hoveredNodeTimeout);
            state.hoveredNodeTimeout = null;
        }
        
        if (hoveredNode !== state.hoveredNode) {
            if (hoveredNode) {
                // Сразу показываем кнопки
                state.hoveredNode = hoveredNode;
                render();
            } else {
                // Задержка 500мс перед скрытием
                state.hoveredNodeTimeout = setTimeout(() => {
                    state.hoveredNode = null;
                    render();
                }, CONFIG.HOVER_DELAY);
            }
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (state.isDragging && state.selectedNodes.length > 0) {
        saveHistory();
    }

    state.isDragging = false;
    state.isPanning = false;
    state.dragStart = null;
});

canvas.addEventListener('dblclick', (e) => {
    if (state.editingNode) return;
    
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const clickedNode = getNodeAt(worldPos.x, worldPos.y);
    
    if (clickedNode) {
        // Проверяем есть ли много текста
        ctx.font = `${CONFIG.FONT_SIZE}px ${CONFIG.FONT_FAMILY}`;
        const lines = clickedNode.wrapText(ctx, clickedNode.text, 
                                        clickedNode.width - CONFIG.NODE_PADDING * 2);
        
        if (lines.length > 1) {
            // Если много текста - toggle сворачивание
            clickedNode.isCollapsed = !clickedNode.isCollapsed;
            render();
            return;
        }
        
        // Если текста мало - начинаем редактирование
        startEditingNode(clickedNode);
    } else {
        // Создаем новый узел на пустом месте
        createNode(worldPos.x, worldPos.y, 'Новый узел', CONFIG.COLORS[0]);
        render();
    }
});


canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -CONFIG.ZOOM_STEP : CONFIG.ZOOM_STEP;
    zoom(delta, e.clientX, e.clientY);
});

// Наведение для сворачивания больших узлов
canvas.addEventListener('mouseover', (e) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const hoveredNode = getNodeAt(worldPos.x, worldPos.y);

    if (hoveredNode && hoveredNode.height > CONFIG.NODE_HEIGHT) {
        hoveredNode.isCollapsed = false;
        render();
    }
});

/*
canvas.addEventListener('mouseout', (e) => {
    state.nodes.forEach(node => {
        if (node.height > CONFIG.NODE_HEIGHT) {
            node.isCollapsed = true;
        }
    });
    render();
});
*/

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ КЛАВИАТУРЫ
// ============================================================
document.addEventListener('keydown', (e) => {
    // Не обрабатываем, если фокус на input/textarea
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return;
    }

    // Редактирование текста узла
    if (state.editingNode) {
        if (e.key === 'Escape') {
            stopEditingNode();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            state.editingNode.text += '\n';
            state.editingNode.updateHeight(ctx);  // ← ДОБАВЬТЕ
            render();
        } else if (e.key === 'Backspace') {
            state.editingNode.text = state.editingNode.text.slice(0, -1);
            state.editingNode.updateHeight(ctx);  // ← ДОБАВЬТЕ
            render();
        } else if (e.key.length === 1) {
            state.editingNode.text += e.key;
            state.editingNode.updateHeight(ctx);  // ← ДОБАВЬТЕ
            render();
        }
        return;
    }

    // Удаление узла
    if (e.key === 'Backspace' && state.selectedNodes.length > 0) {
        e.preventDefault();
        state.selectedNodes.forEach(node => deleteNode(node));
        state.selectedNodes = [];
        render();
        return;
    }

    // Начать редактирование при вводе текста
    if (state.selectedNodes.length === 1 && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
        const node = state.selectedNodes[0];
        node.text += e.key;
        node.updateHeight(ctx);
        startEditingNode(node);
        render();
        return;
        //node.text = e.key;
        //startEditingNode(node);
        //render();
        //return;
    }

    // Горячие клавиши с Ctrl
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'c':
                e.preventDefault();
                copySelectedNodes();
                break;
            case 'v':
                e.preventDefault();
                if (state.editingNode) {
                    navigator.clipboard.readText().then(text => {
                        state.editingNode.text += text;
                        state.editingNode.updateHeight(ctx);
                        render();
                    }).catch(err => {
                        console.log('Не удалось прочитать буфер обмена:', err);
                    });
                } else {
                    // Если не редактируем - вставляем узлы
                    pasteNodes();
                }
                break;
            case 'x':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    cutNodes();  // Вырезать узлы
                }
                break;
            case 'z':
                e.preventDefault();
                undo();
                break;
            case 'y':
                e.preventDefault();
                redo();
                break;
            case 'e':
                e.preventDefault();
                const data = {
                    nodes: state.nodes.map(n => ({
                        id: n.id,
                        x: n.x,
                        y: n.y,
                        text: n.text,
                        color: n.color,
                        width: n.width,
                        height: n.height,
                        children: n.children.map(c => c.id),
                        parent: n.parent ? n.parent.id : null
                    })),
                    connections: state.connections.map(c => ({
                        from: c.from.id,
                        to: c.to.id
                    }))
                };
                
                const json = JSON.stringify(data, null, 2);
                document.getElementById('jsonOutput').value = json;
                document.getElementById('exportModal').classList.add('active');
                break;
            case 'i':
                e.preventDefault();
                document.getElementById('importModal').classList.add('active');
                break;
            case 'h':
                e.preventDefault();
                document.getElementById('helpModal').classList.add('active');
                break;
            case 's':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    saveToLocalStorage();
                    // Можно добавить уведомление
                }
                break;
            case '+':
            case '=':
                e.preventDefault();
                zoom(CONFIG.ZOOM_STEP);
                break;
            case '-':
                e.preventDefault();
                zoom(-CONFIG.ZOOM_STEP);
                break;
        }
    }

    // Стрелки для навигации
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const speed = CONFIG.PAN_SPEED;
        switch(e.key) {
            case 'ArrowUp': panCamera(0, speed); break;
            case 'ArrowDown': panCamera(0, -speed); break;
            case 'ArrowLeft': panCamera(speed, 0); break;
            case 'ArrowRight': panCamera(-speed, 0); break;
        }
    }
});

// Обработчик вставки (работает во всех браузерах)
document.addEventListener('paste', (e) => {
    if (!state.editingNode) return;
    
    e.preventDefault();
    
    const text = (e.clipboardData || window.clipboardData).getData('text');
    
    if (text) {
        state.editingNode.text += text;
        state.editingNode.updateHeight(ctx);
        render();
    }
});

// Обработчик копирования текста узла
document.addEventListener('copy', (e) => {
    if (!state.editingNode) return;
    
    e.preventDefault();
    
    if (e.clipboardData) {
        e.clipboardData.setData('text/plain', state.editingNode.text);
    }
});

// Обработчик вырезания (Ctrl+X)
document.addEventListener('cut', (e) => {
    if (!state.editingNode) return;
    
    e.preventDefault();
    
    if (e.clipboardData) {
        e.clipboardData.setData('text/plain', state.editingNode.text);
    }
    
    state.editingNode.text = '';
    state.editingNode.updateHeight(ctx);
    render();
});


// ============================================================
// ОБРАБОТЧИКИ КНОПОК UI
// ============================================================
document.getElementById('zoomIn').addEventListener('click', () => zoom(CONFIG.ZOOM_STEP));
document.getElementById('zoomOut').addEventListener('click', () => zoom(-CONFIG.ZOOM_STEP));
document.getElementById('zoomReset').addEventListener('click', resetZoom);
document.getElementById('centerView').addEventListener('click', centerView);
document.getElementById('autoLayout').addEventListener('click', autoLayout);
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('help').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('active');
});
document.getElementById('newMap').addEventListener('click', newMap);

// Модальные окна
document.getElementById('closeExport').addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('active');
});

document.getElementById('closeImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('active');
});

document.getElementById('closeHelp').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('active');
});

document.getElementById('closeHelpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('active');
});

document.getElementById('exportPNG').addEventListener('click', exportToPNG);
document.getElementById('exportJSON').addEventListener('click', exportToJSON);

document.getElementById('importJSON').addEventListener('click', () => {
    const json = document.getElementById('jsonInput').value;
    if (importFromJSON(json)) {
        document.getElementById('importModal').classList.remove('active');
        document.getElementById('jsonInput').value = '';
    }
});

document.getElementById('cancelImport').addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('active');
});

// Закрытие модальных окон по клику вне их
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ: СОЗДАЕМ НАЧАЛЬНЫЕ УЗЛЫ
// ============================================================
function init() {
    // Пытаемся загрузить сохраненную карту
    const loaded = loadFromLocalStorage();
    
    if (!loaded) {
        newMap()
        /*
        // Создаем начальные узлы только если нет сохранения
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const root = createNode(centerX, centerY, 'Mind Map Editor', CONFIG.COLORS[0]);
        const child1 = createNode(centerX - 200, centerY, 'Идея 1', CONFIG.COLORS[1]);
        const child2 = createNode(centerX + 200, centerY, 'Идея 2', CONFIG.COLORS[2]);
        
        root.children = [child1, child2];
        child1.parent = root;
        child2.parent = root;
        
        state.connections.push(new Connection(root, child1));
        state.connections.push(new Connection(root, child2));
        */
    }
    
    saveHistory();
    render();
}


init();