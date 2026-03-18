// 文件: school.js - 仅保留夏季/秋季时间选择
// ==================== 验证函数 ====================
function validateDate(dateStr) {
    if (!dateStr || dateStr.trim().length === 0) {
        return "日期不能为空！";
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dateStr)) {
        return "日期格式必须是 YYYY-MM-DD！";
    }
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return "请输入有效的日期！";
    }
    return false;
}
function validateName(name) {
    if (name === null || name.trim().length === 0) {
        return "输入不能为空！";
    }
    if (name.length < 2) {
        return "至少需要2个字符！";
    }
    return false;
}

// ==================== 课表数据提取函数 ====================
function extractCourseData() {
    console.log("开始提取湖北汽车工业学院课表数据...");
    
    const courses = [];
    const rows = document.querySelectorAll('.el-table__body-wrapper tbody tr');
    console.log(`找到 ${rows.length} 行课表数据`);
    
    rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        for (let dayIndex = 1; dayIndex < cells.length; dayIndex++) {
            const cell = cells[dayIndex];
            const day = dayIndex - 1; // 星期映射：1=周一(0), 2=周二(1)...7=周日(6)
            const courseBlocks = cell.querySelectorAll('[class*="theory"], .theory, [class*="course"], div[style*="background"]');
            
            if (courseBlocks.length > 0) {
                courseBlocks.forEach(block => {
                    try {
                        const course = parseCourseBlock(block, day, rowIndex);
                        if (course) {
                            courses.push(course);
                        }
                    } catch (e) {
                        console.error("解析课程块失败:", e);
                    }
                });
            }
        }
    });
    
    // 备用选择器
    if (courses.length === 0) {
        console.log("尝试使用备用选择器...");
        const allCourseElements = document.querySelectorAll('[class*="theory"], .theory, [class*="course"]');
        console.log(`找到 ${allCourseElements.length} 个可能的课程元素`);
        
        allCourseElements.forEach(element => {
            const td = element.closest('td');
            if (td) {
                const tr = td.closest('tr');
                if (tr) {
                    const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
                    const dayIndex = Array.from(td.parentNode.children).indexOf(td);
                    
                    if (dayIndex >= 1 && dayIndex <= 7) {
                        const day = dayIndex - 1;
                        const course = parseCourseBlock(element, day, rowIndex);
                        if (course) {
                            courses.push(course);
                        }
                    }
                }
            }
        });
    }
    
    // 去重+排序
    const uniqueCourses = removeDuplicates(courses);
    uniqueCourses.sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.startSection - b.startSection;
    });
    
    console.log(`共提取到 ${uniqueCourses.length} 门课程`);
    return uniqueCourses;
}

function parseCourseBlock(block, day, rowIndex) {
    let name = '', teacher = '', position = '', weeks = [];
    const children = block.children;
    
    // 解析子元素
    if (children.length >= 3) {
        const nameElement = block.querySelector('h3');
        if (nameElement) {
            name = nameElement.innerText.trim().replace(/[（(]\d{3,}[）)]/g, '').trim();
        }
        
        const teacherElement = block.querySelector('p:first-child span:first-child, p:nth-child(1) span');
        if (teacherElement) {
            teacher = teacherElement.innerText.trim().replace(/\d+H?$/, '').trim();
        }
        
        const weekPositionElement = block.querySelector('p:nth-child(2) span, p:last-child span');
        if (weekPositionElement) {
            const result = parseWeekAndPosition(weekPositionElement.innerText.trim());
            weeks = result.weeks;
            position = result.position;
        }
    }
    
    // 文本行解析备用
    if (!name || !teacher || !position) {
        const text = block.innerText;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length >= 3) {
            if (!name) name = lines[0].trim().replace(/[（(]\d{3,}[）)]/g, '').trim();
            if (!teacher) teacher = lines[1].trim().replace(/\d+H?$/, '').trim();
            if (!position) {
                const result = parseWeekAndPosition(lines[2].trim());
                weeks = result.weeks;
                position = result.position;
            }
        }
    }
    
    // 提取教室
    if (!position || position === '未知教室') {
        position = extractClassroom(block.innerText);
    }
    
    // 节次映射
    let startSection, endSection;
    switch(rowIndex) {
        case 0: startSection = 1; endSection = 1; break;
        case 1: startSection = 2; endSection = 2; break;
        case 2: startSection = 3; endSection = 3; break;
        case 3: startSection = 4; endSection = 4; break;
        case 4: startSection = 5; endSection = 5; break;
        case 5: startSection = 6; endSection = 6; break;
        case 6: startSection = 7; endSection = 7; break;
        case 7: startSection = 8; endSection = 8; break;
        case 8: startSection = 9; endSection = 9; break;
        case 9: startSection = 10; endSection = 10; break;
        case 10: startSection = 11; endSection = 11; break;
        default: startSection = 1; endSection = 1;
    }
    
    // 连堂处理
    const td = block.closest('td');
    if (td) {
        const rowspan = td.getAttribute('rowspan');
        if (rowspan) {
            const span = parseInt(rowspan);
            if (span > 1) {
                endSection = startSection + span - 1;
                if (endSection > 11) endSection = 11;
            }
        }
    }
    
    // 过滤无效课程
    if (!name || name.includes('节') || name.length < 2 || name.includes('理论课')) {
        return null;
    }
    
    // 体育课特殊处理
    if (name.includes('体育') && position === '未知教室') {
        position = '操场';
    }
    
    return {
        name: name,
        teacher: teacher || '未知教师',
        position: position || '未知教室',
        day: day,
        startSection: startSection,
        endSection: endSection,
        weeks: weeks.length > 0 ? weeks : [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
        isCustomTime: false
    };
}

function parseWeekAndPosition(text) {
    let weeks = [];
    let position = '未知教室';
    
    if (!text) return { weeks, position };
    
    // 解析周次
    const weekPattern = /(\d+-\d+周|\d+,\d+周|\d+周)/;
    const weekMatch = text.match(weekPattern);
    if (weekMatch) {
        weeks = parseWeeks(weekMatch[1]);
        const remaining = text.replace(weekMatch[1], '').trim();
        if (remaining && /\d+/.test(remaining)) {
            position = remaining;
        } else {
            const roomMatch = text.match(/\b\d{3,4}\b/);
            if (roomMatch) position = roomMatch[0];
        }
    } else {
        const roomMatch = text.match(/\b\d{3,4}\b/);
        if (roomMatch) {
            position = roomMatch[0];
            weeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
        }
    }
    
    // 清理教室
    if (position && position !== '未知教室') {
        position = position.replace(/[^\d]/g, '');
    }
    
    return { weeks, position };
}

function extractClassroom(text) {
    const roomPatterns = [/\b\d{4}\b/, /\b\d{3}\b/, /[0-9]{3,4}/];
    for (let pattern of roomPatterns) {
        const match = text.match(pattern);
        if (match) return match[0];
    }
    return '未知教室';
}

function parseWeeks(weekStr) {
    const weeks = [];
    if (!weekStr) return [];
    
    weekStr = weekStr.replace(/周/g, '').trim();
    try {
        if (weekStr.includes(',')) {
            weekStr.split(',').forEach(part => {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    for (let i = start; i <= end; i++) weeks.push(i);
                } else {
                    const w = parseInt(part);
                    if (!isNaN(w)) weeks.push(w);
                }
            });
        } else if (weekStr.includes('-')) {
            const [start, end] = weekStr.split('-').map(Number);
            for (let i = start; i <= end; i++) weeks.push(i);
        } else {
            const w = parseInt(weekStr);
            if (!isNaN(w)) weeks.push(w);
        }
    } catch (e) {
        console.error("解析周次失败:", weekStr, e);
    }
    
    return weeks.length > 0 ? weeks.sort((a,b) => a-b) : [];
}

function removeDuplicates(courses) {
    const seen = new Map();
    return courses.filter(course => {
        const key = `${course.name}-${course.teacher}-${course.day}-${course.startSection}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
}

function extractSemesterInfo() {
    return {
        semesterStartDate: "2026-03-01",
        semesterTotalWeeks: 20
    };
}

// ==================== 时间段配置（仅保留夏季/秋季） ====================
/**
 * 获取夏季/秋季时间段配置
 * @param {string} season 可选值：'summer'（夏季）、'autumn'（秋季）
 */
function getSeasonTimeSlots(season) {
    // 上午固定时间（夏秋通用）
    const morning_classes = [
        {"number": 1, "startTime": "08:10", "endTime": "08:55"},
        {"number": 2, "startTime": "09:00", "endTime": "09:45"},
        {"number": 3, "startTime": "10:05", "endTime": "10:50"},
        {"number": 4, "startTime": "10:55", "endTime": "11:40"}
    ];
    
    // 夏季下午/晚上时间
    const summer_afternoon_evening = [
        {"number": 5, "startTime": "14:30", "endTime": "15:15"},
        {"number": 6, "startTime": "15:20", "endTime": "16:05"},
        {"number": 7, "startTime": "16:25", "endTime": "17:10"},
        {"number": 8, "startTime": "17:15", "endTime": "18:00"},
        {"number": 9, "startTime": "18:45", "endTime": "19:30"},
        {"number": 10, "startTime": "19:35", "endTime": "20:20"},
        {"number": 11, "startTime": "20:25", "endTime": "21:10"}
    ];
    
    // 秋季下午/晚上时间
    const autumn_afternoon_evening = [
        {"number": 5, "startTime": "14:00", "endTime": "14:45"},
        {"number": 6, "startTime": "14:50", "endTime": "15:35"},
        {"number": 7, "startTime": "15:55", "endTime": "16:40"},
        {"number": 8, "startTime": "16:45", "endTime": "17:30"},
        {"number": 9, "startTime": "18:15", "endTime": "19:00"},
        {"number": 10, "startTime": "19:05", "endTime": "19:50"},
        {"number": 11, "startTime": "19:55", "endTime": "20:40"}
    ];

    // 拼接完整时间段
    if (season === 'summer') {
        return morning_classes.concat(summer_afternoon_evening);
    } else if (season === 'autumn') {
        return morning_classes.concat(autumn_afternoon_evening);
    } else {
        // 默认返回夏季
        return morning_classes.concat(summer_afternoon_evening);
    }
}

/**
 * 导入指定季节的时间段
 */
async function importSeasonTimeSlots(season) {
    console.log(`正在导入${season === 'summer' ? '夏季' : '秋季'}时间段数据...`);
    
    const timeSlots = getSeasonTimeSlots(season);
    
    try {
        const result = await window.AndroidBridgePromise.savePresetTimeSlots(JSON.stringify(timeSlots));
        if (result === true) {
            const seasonName = season === 'summer' ? '夏季' : '秋季';
            window.AndroidBridge.showToast(`${seasonName}时间段导入成功！`);
            return true;
        } else {
            console.log("时间段导入未成功，结果：" + result);
            window.AndroidBridge.showToast("时间段导入失败，请查看日志。");
            return false;
        }
    } catch (error) {
        console.error("导入时间段时发生错误:", error);
        window.AndroidBridge.showToast("导入时间段失败: " + error.message);
        return false;
    }
}

// ==================== 弹窗和核心函数 ====================
async function demoAlert() {
    try {
        const confirmed = await window.AndroidBridgePromise.showAlert(
            "📚 湖北汽车工业学院课表导入",
            "将提取当前页面的课表数据并导入到App\n\n" +
            "📌 请确认已在课表页面\n" +
            "📌 将提取所有可见课程",
            "开始导入",
            "取消"
        );
        return confirmed;
    } catch (error) {
        console.error("显示弹窗错误:", error);
        return false;
    }
}

async function demoPrompt() {
    try {
        const semesterInfo = extractSemesterInfo();
        const semesterStart = await window.AndroidBridgePromise.showPrompt(
            "📅 设置开学日期",
            "请输入本学期开学日期",
            semesterInfo.semesterStartDate,
            "validateDate"
        );
        return semesterStart || semesterInfo.semesterStartDate;
    } catch (error) {
        console.error("日期输入错误:", error);
        return "2026-03-01";
    }
}

async function importSchedule() {
    try {
        AndroidBridge.showToast("正在提取课表数据...");
        
        const courses = extractCourseData();
        
        if (courses.length === 0) {
            await window.AndroidBridgePromise.showAlert(
                "⚠️ 提取失败",
                "未找到课表数据，请确认已在课表页面",
                "知道了"
            );
            return false;
        }
        
        // 数据预览
        const preview = await window.AndroidBridgePromise.showAlert(
            "📊 数据预览",
            `共找到 ${courses.length} 门课程\n\n` +
            `示例:\n${courses.slice(0, 5).map(c => 
                `• 周${c.day+1} ${c.name} - 第${c.startSection}-${c.endSection}节`
            ).join('\n')}`,
            "确认导入",
            "取消"
        );
        
        if (!preview) return false;
        
        // 导入课程
        AndroidBridge.showToast("正在导入课程...");
        const result = await window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(courses));
        
        if (result === true) {
            const semesterDate = await demoPrompt();
            const configResult = await window.AndroidBridgePromise.saveCourseConfig(JSON.stringify({
                semesterStartDate: semesterDate,
                semesterTotalWeeks: 20,
                defaultClassDuration: 45,
                defaultBreakDuration: 10,
                firstDayOfWeek: 1
            }));
            
            if (configResult === true) {
                AndroidBridge.showToast(`✅ 导入成功！共${courses.length}门课程`);
                return true;
            }
        }
        
        AndroidBridge.showToast("❌ 导入失败");
        return false;
        
    } catch (error) {
        console.error("导入错误:", error);
        AndroidBridge.showToast("导入出错: " + error.message);
        return false;
    }
}

/**
 * 显示夏季/秋季选择弹窗并导入对应时间段
 */
async function selectAndImportTimeSlots() {
    // 构建选择弹窗内容
    const alertContent = `请选择本学期的时间段类型：
1. 夏季时间段（下午14:30开始）
2. 秋季时间段（下午14:00开始）

请输入数字 1 或 2 选择对应的时间段`;

    try {
        // 显示选择弹窗
        const selected = await window.AndroidBridgePromise.showPrompt(
            "⏰ 选择时间段类型",
            alertContent,
            "1", // 默认选择夏季
            ""
        );

        // 处理取消/空输入
        if (!selected || selected === '取消') {
            AndroidBridge.showToast("已取消时间段导入");
            return false;
        }

        // 验证输入
        if (selected !== '1' && selected !== '2') {
            AndroidBridge.showToast("输入无效！请输入 1 或 2");
            return await selectAndImportTimeSlots(); // 重新选择
        }

        // 导入对应时间段
        const season = selected === '1' ? 'summer' : 'autumn';
        return await importSeasonTimeSlots(season);

    } catch (error) {
        console.error("选择时间段出错:", error);
        AndroidBridge.showToast("选择时间段失败: " + error.message);
        return false;
    }
}

/**
 * 主执行函数
 */
async function runAllDemosSequentially() {
    AndroidBridge.showToast("🚀 课表导入助手启动...");
    
    // 页面检查
    if (!window.location.href.includes('studentHome/expectCourseTable')) {
        const goToPage = await window.AndroidBridgePromise.showAlert(
            "页面提示",
            "当前不在课表页面，是否跳转？",
            "跳转",
            "取消"
        );
        if (goToPage) {
            window.location.href = 'http://neweas.huat.edu.cn/#/studentHome/expectCourseTable';
        }
        return;
    }
    
    // 确认导入
    const start = await demoAlert();
    if (!start) {
        AndroidBridge.showToast("已取消");
        return;
    }
    
    // 选择并导入夏/秋季时间段
    await selectAndImportTimeSlots();
    
    // 导入课表数据
    await importSchedule();
    
    AndroidBridge.notifyTaskCompletion();
}

// 导出全局函数
window.validateDate = validateDate;
window.validateName = validateName;
window.extractCourseData = extractCourseData;
window.importSeasonTimeSlots = importSeasonTimeSlots;

// 启动程序
runAllDemosSequentially();