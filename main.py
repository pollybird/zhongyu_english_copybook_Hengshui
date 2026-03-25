import sys
import os
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QTextEdit, QComboBox, QSpinBox, QCheckBox,
    QPushButton, QGroupBox, QGridLayout, QFileDialog, QScrollArea,
    QColorDialog, QListWidget, QListWidgetItem, QInputDialog, QMessageBox,
    QMenuBar, QMenu, QTabWidget, QTabBar
)
from PyQt6.QtGui import (
    QPainter, QPen, QFont, QColor, QPixmap, QFontDatabase, QPageSize,
    QPdfWriter, QTextDocument, QAction, QKeySequence, QIcon
)
from PyQt6.QtCore import Qt, QRect, QSize, QPoint
import json

# 导入自定义模块
from renderers import LineRenderer, FourLineGrid, SingleLine
from utils import calculate_total_pages, calculate_word_index_for_page
from dialogs import UserAgreementDialog
from style import Style

from PyQt6.QtCore import pyqtSignal

class CopybookTab(QWidget):
    # 定义信号，当内容修改时发出
    modified_changed = pyqtSignal()
    
    def __init__(self, parent, font_family):
        super().__init__(parent)
        self.font_family = font_family
        
        # 初始化参数
        self.text_content = ''
        self.font_size = 18  # 默认字号改为18
        self.letter_spacing = 0
        self.position_x = 0
        self.position_y = 0
        self.line_type = '四线三格'
        self.generate_mode = '描红'
        self.custom_headers = ['班级', '姓名', '学号']  # 初始化自定义字段
        self.title = '英文字帖'
        self.current_page = 0  # 当前页码
        self.total_pages = 1  # 总页数
        self.show_page_number = True  # 是否显示页码
        self.current_file = None  # 当前打开的文件路径
        self.modified = False  # 是否修改过
        
        # 创建UI
        self.create_ui()
        
    def create_ui(self):
        # 主布局
        main_layout = QVBoxLayout(self)
        
        # 中间内容区域
        content_layout = QHBoxLayout()
        main_layout.addLayout(content_layout)
        
        # 左侧设置面板
        settings_panel = QWidget()
        settings_layout = QVBoxLayout(settings_panel)
        content_layout.addWidget(settings_panel, 1)
        
        # 输入文本区域
        text_group = QGroupBox('输入内容')
        text_layout = QVBoxLayout(text_group)
        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText('请输入要生成字帖的英文内容...')
        self.text_edit.textChanged.connect(self.on_text_changed)
        # 增大输入内容的多行文本框的高度
        self.text_edit.setMinimumHeight(150)
        text_layout.addWidget(self.text_edit)
        settings_layout.addWidget(text_group)
        
        # 字体设置和位置调整放在同一组
        adjust_group = QGroupBox('调整设置')
        adjust_layout = QGridLayout(adjust_group)
        
        # 字体大小和字间距放到一行
        font_size_label = QLabel('字体大小:')
        self.font_size_spin = QSpinBox()
        self.font_size_spin.setRange(10, 50)
        self.font_size_spin.setValue(self.font_size)
        self.font_size_spin.valueChanged.connect(self.update_font_size)
        adjust_layout.addWidget(font_size_label, 0, 0)
        adjust_layout.addWidget(self.font_size_spin, 0, 1)
        
        spacing_label = QLabel('字间距:')
        self.spacing_spin = QSpinBox()
        self.spacing_spin.setRange(-10, 20)
        self.spacing_spin.setValue(self.letter_spacing)
        self.spacing_spin.valueChanged.connect(self.update_spacing)
        adjust_layout.addWidget(spacing_label, 0, 2)
        adjust_layout.addWidget(self.spacing_spin, 0, 3)
        
        # X轴偏移和Y轴偏移放到一行
        x_label = QLabel('X轴偏移:')
        self.x_spin = QSpinBox()
        self.x_spin.setRange(-50, 50)
        self.x_spin.setValue(self.position_x)
        self.x_spin.valueChanged.connect(self.update_position)
        adjust_layout.addWidget(x_label, 1, 0)
        adjust_layout.addWidget(self.x_spin, 1, 1)
        
        y_label = QLabel('Y轴偏移:')
        self.y_spin = QSpinBox()
        self.y_spin.setRange(-50, 50)
        self.y_spin.setValue(self.position_y)
        self.y_spin.valueChanged.connect(self.update_position)
        adjust_layout.addWidget(y_label, 1, 2)
        adjust_layout.addWidget(self.y_spin, 1, 3)
        
        settings_layout.addWidget(adjust_group)
        
        # 线格类型
        line_group = QGroupBox('线格类型')
        line_layout = QVBoxLayout(line_group)
        self.line_combo = QComboBox()
        self.line_combo.addItems(['四线三格', '单横线'])
        self.line_combo.currentTextChanged.connect(self.update_line_type)
        line_layout.addWidget(self.line_combo)
        settings_layout.addWidget(line_group)
        
        # 生成模式
        mode_group = QGroupBox('生成模式')
        mode_layout = QVBoxLayout(mode_group)
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(['描红', '抄写', '描红+抄写', '字帖'])
        self.mode_combo.currentTextChanged.connect(self.update_generate_mode)
        mode_layout.addWidget(self.mode_combo)
        settings_layout.addWidget(mode_group)
        
        # 标题设置
        title_group = QGroupBox('标题设置')
        title_layout = QVBoxLayout(title_group)
        title_label = QLabel('字帖标题:')
        self.title_edit = QLineEdit()
        self.title_edit.setText(self.title)
        self.title_edit.textChanged.connect(self.update_title)
        title_layout.addWidget(title_label)
        title_layout.addWidget(self.title_edit)
        
        # 添加页码显示选项
        self.page_number_checkbox = QCheckBox('显示页码')
        self.page_number_checkbox.setChecked(self.show_page_number)
        self.page_number_checkbox.stateChanged.connect(self.update_show_page_number)
        title_layout.addWidget(self.page_number_checkbox)
        
        settings_layout.addWidget(title_group)
        
        # 自定义头部
        header_group = QGroupBox('自定义头部')
        header_layout = QVBoxLayout(header_group)
        
        header_buttons_layout = QHBoxLayout()
        add_header_button = QPushButton('添加字段')
        add_header_button.clicked.connect(self.add_header)
        remove_header_button = QPushButton('删除字段')
        remove_header_button.clicked.connect(self.remove_header)
        header_buttons_layout.addWidget(add_header_button)
        header_buttons_layout.addWidget(remove_header_button)
        header_layout.addLayout(header_buttons_layout)
        
        self.header_list = QListWidget()
        # 添加初始化的自定义字段
        for header in self.custom_headers:
            item = QListWidgetItem(header)
            self.header_list.addItem(item)
        # 减小自定义头部的高度
        self.header_list.setMaximumHeight(80)
        header_layout.addWidget(self.header_list)
        settings_layout.addWidget(header_group)
        
        # 右侧预览区域
        preview_panel = QWidget()
        preview_layout = QVBoxLayout(preview_panel)
        content_layout.addWidget(preview_panel, 2)
        
        preview_label = QLabel('预览效果')
        preview_layout.addWidget(preview_label)
        
        # 翻页控制
        page_control_layout = QHBoxLayout()
        
        # 创建上一页按钮，使用图标
        self.prev_button = QPushButton()
        # 只设置文本作为箭头图标
        self.prev_button.setText('←')
        self.prev_button.setFixedSize(40, 30)  # 设置按钮大小
        self.prev_button.clicked.connect(self.prev_page)
        self.prev_button.setEnabled(False)
        page_control_layout.addWidget(self.prev_button)
        
        # 添加伸缩空间，使页码居中
        page_control_layout.addStretch()
        
        self.page_label = QLabel('第 1 页 / 共 1 页')
        page_control_layout.addWidget(self.page_label)
        
        # 添加伸缩空间，使页码居中
        page_control_layout.addStretch()
        
        # 创建下一页按钮，使用图标
        self.next_button = QPushButton()
        # 只设置文本作为箭头图标
        self.next_button.setText('→')
        self.next_button.setFixedSize(40, 30)  # 设置按钮大小
        self.next_button.clicked.connect(self.next_page)
        self.next_button.setEnabled(False)
        page_control_layout.addWidget(self.next_button)
        
        # 为翻页按钮添加快捷键
        from PyQt6.QtGui import QShortcut, QKeySequence
        QShortcut(QKeySequence('PageUp'), self, self.prev_page)
        QShortcut(QKeySequence('PageDown'), self, self.next_page)
        
        preview_layout.addLayout(page_control_layout)
        
        self.preview_scroll = QScrollArea()
        self.preview_widget = QWidget()
        # 设置对象名称，用于样式选择器
        self.preview_widget.setObjectName("preview_widget")
        self.preview_layout = QVBoxLayout(self.preview_widget)
        self.preview_scroll.setWidget(self.preview_widget)
        self.preview_scroll.setWidgetResizable(True)
        preview_layout.addWidget(self.preview_scroll)
        
        # 初始预览
        self.update_preview()
    
    def update_font_size(self, value):
        self.font_size = value
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_spacing(self, value):
        self.letter_spacing = value
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_position(self):
        self.position_x = self.x_spin.value()
        self.position_y = self.y_spin.value()
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_line_type(self, text):
        self.line_type = text
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_generate_mode(self, text):
        self.generate_mode = text
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_title(self, text):
        self.title = text
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_show_page_number(self, state):
        self.show_page_number = state == Qt.CheckState.Checked
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def add_header(self):
        # 检查自定义字段是否已达到上限
        if len(self.custom_headers) >= 3:
            QMessageBox.warning(self, '添加字段失败', '自定义字段最多只能有3个！')
            return
        
        text, ok = QInputDialog.getText(self, '添加字段', '请输入字段名称:')
        if ok and text:
            self.custom_headers.append(text)
            item = QListWidgetItem(text)
            self.header_list.addItem(item)
            self.modified = True
            self.modified_changed.emit()
            self.update_preview()
    
    def remove_header(self):
        selected_items = self.header_list.selectedItems()
        if selected_items:
            for item in selected_items:
                text = item.text()
                if text in self.custom_headers:
                    self.custom_headers.remove(text)
                self.header_list.takeItem(self.header_list.row(item))
            self.modified = True
            self.modified_changed.emit()
            self.update_preview()
    
    def on_text_changed(self):
        # 文本内容变化时设置修改状态
        self.modified = True
        self.modified_changed.emit()
        self.update_preview()
    
    def update_preview(self):
        # 清空预览区域
        for i in reversed(range(self.preview_layout.count())):
            widget = self.preview_layout.itemAt(i).widget()
            if widget:
                widget.deleteLater()
        
        # 获取文本内容
        self.text_content = self.text_edit.toPlainText()
        
        # 计算总页数
        self.total_pages = self.calculate_total_pages()
        
        # 更新页码显示
        self.page_label.setText(f'第 {self.current_page + 1} 页 / 共 {self.total_pages} 页')
        self.prev_button.setEnabled(self.current_page > 0)
        self.next_button.setEnabled(self.current_page < self.total_pages - 1)
        
        # 计算当前页的起始单词索引
        word_index = self.calculate_word_index_for_page(self.current_page)
        
        # 创建预览画布
        preview_pixmap = QPixmap(800, 1131)  # A4纸比例
        preview_pixmap.fill(Qt.GlobalColor.white)
        
        # 绘制预览
        painter = QPainter(preview_pixmap)
        self.draw_copybook(painter, QRect(20, 20, 760, 1091), word_index, self.current_page, self.total_pages)
        painter.end()
        
        # 显示预览
        preview_label = QLabel()
        preview_label.setPixmap(preview_pixmap)
        preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_layout.addWidget(preview_label)
    
    def calculate_total_pages(self):
        # 计算总页数
        return calculate_total_pages(
            self.text_content, 
            self.font_size, 
            self.letter_spacing, 
            self.generate_mode
        )
    
    def calculate_word_index_for_page(self, page):
        # 计算指定页的起始单词索引
        return calculate_word_index_for_page(
            page, 
            self.text_content, 
            self.font_size, 
            self.letter_spacing, 
            self.generate_mode
        )
    
    def prev_page(self):
        if self.current_page > 0:
            self.current_page -= 1
            self.update_preview()
    
    def next_page(self):
        if self.current_page < self.total_pages - 1:
            self.current_page += 1
            self.update_preview()
    
    def draw_copybook(self, painter, rect, word_index=0, current_page=0, total_pages=1):
        # 绘制头部
        self.draw_header(painter, rect)
        
        # 计算内容区域
        header_height = 100
        content_rect = QRect(rect.left(), rect.top() + header_height, rect.width(), rect.height() - header_height)
        
        # 绘制线格和文字
        word_index = self.draw_lines_and_text(painter, content_rect, word_index)
        
        # 绘制页码
        if self.show_page_number:
            # 设置页码字体
            page_font = QFont(self.font_family, 12)
            painter.setFont(page_font)
            painter.setPen(QPen(Qt.GlobalColor.gray))
            
            # 计算页码位置（底部居中）
            page_text = f'第 {current_page + 1} 页 / 共 {total_pages} 页'
            page_rect = QRect(rect.left(), rect.bottom() - 30, rect.width(), 20)
            painter.drawText(page_rect, Qt.AlignmentFlag.AlignCenter, page_text)
        
        return word_index
    
    def draw_header(self, painter, rect):
        # 设置标题字体（粗体，字号增大）
        title_font = QFont(self.font_family, 18)
        title_font.setBold(True)
        painter.setFont(title_font)
        
        # 显式设置标题颜色为黑色
        painter.setPen(QPen(Qt.GlobalColor.black))
        
        # 绘制标题（居中显示）
        title_rect = QRect(rect.left(), rect.top(), rect.width(), 50)
        painter.drawText(title_rect, Qt.AlignmentFlag.AlignCenter, self.title)
        
        # 设置字段字体
        field_font = QFont(self.font_family, 12)
        painter.setFont(field_font)
        
        # 绘制自定义字段（新行显示，居中）
        if self.custom_headers:
            # 计算每个字段的宽度
            field_width = 200
            total_width = field_width * len(self.custom_headers)
            # 计算起始 x 坐标，使得整个字段行居中
            start_x = rect.left() + (rect.width() - total_width) // 2
            # 增加与标题行之间的间距
            field_y = rect.top() + 80  # 从 60 改为 80，增加 20 的间距
            # 绘制每个字段
            for i, header in enumerate(self.custom_headers):
                x_offset = start_x + i * field_width
                painter.drawText(x_offset, field_y, f'{header}: _______________')
    
    def draw_lines_and_text(self, painter, rect, word_index=0):
        # 重新设计绘制逻辑，使用分支结构处理不同模式的布局
        
        # 计算线的参数
        if self.line_type == '四线三格':
            line_height = 40  # 每行的高度
            group_gap = 40  # 组之间的间距
        else:  # 单横线模式
            line_height = 30  # 单横线模式下的行高，确保所有线间距相同
            group_gap = 0  # 单横线模式下不需要组间距
        
        # 计算文字区域
        text_left = rect.left() + 10 + self.position_x
        # 根据线格类型设置不同的Y轴偏移
        if self.line_type == '四线三格':
            text_y_offset = self.position_y - 4
        else:  # 单横线模式
            text_y_offset = self.position_y - 20
        line_width = rect.width() - 30
        
        # 设置字体
        font = QFont(self.font_family, self.font_size)
        painter.setFont(font)
        
        # 获取字体度量信息，用于计算字符宽度
        font_metrics = painter.fontMetrics()
        
        # 创建线格渲染器
        if self.line_type == '四线三格':
            line_renderer = FourLineGrid()
        else:
            line_renderer = SingleLine()
        
        # 将文本分割成单词列表
        words = []
        lines = self.text_content.split('\n')
        for line in lines:
            line_words = line.split(' ')
            # 保留行首的空格
            leading_spaces = 0
            for i, word in enumerate(line_words):
                if not word:
                    leading_spaces += 1
                else:
                    break
            # 添加行首空格作为一个特殊单词
            if leading_spaces > 0:
                words.append(' ' * leading_spaces)
            # 添加非空单词
            for word in line_words[leading_spaces:]:
                if word:
                    words.append(word)
            words.append('\n')  # 添加换行标记
        
        # 绘制线和文字
        line_y = rect.top() + 20
        
        # 绘制直到页面底部
        while line_y < rect.bottom() - 100:
            # 设置颜色
            if self.generate_mode in ['描红', '描红+抄写']:
                text_color = QColor(255, 100, 100)  # 淡红色
            else:
                text_color = QColor(0, 0, 0)  # 黑色
            
            # 绘制文字行
            line_renderer.draw_line(painter, rect, line_y)
            
            # 绘制文字（文字位置受Y轴偏移影响）
            if word_index < len(words):
                x = text_left
                painter.setPen(QPen(text_color))
                
                # 计算文字的Y坐标，根据线格类型调整
                if self.line_type == '四线三格':
                    text_y = line_y + 30 + text_y_offset
                else:  # 单横线模式
                    text_y = line_y + 20 + text_y_offset
                
                # 在当前行绘制单词，直到行满或遇到换行标记
                while word_index < len(words):
                    word = words[word_index]
                    
                    # 遇到换行标记，移动到下一行
                    if word == '\n':
                        word_index += 1
                        break
                    
                    # 计算单词宽度
                    word_width = 0
                    for char in word:
                        word_width += font_metrics.horizontalAdvance(char) + self.letter_spacing
                    
                    # 如果当前行放不下这个单词，移动到下一行
                    if x + word_width > text_left + line_width and x > text_left:
                        break
                    
                    # 绘制单词
                    for char in word:
                        if x > text_left + line_width:
                            break
                        painter.drawText(x, text_y, char)
                        x += font_metrics.horizontalAdvance(char) + self.letter_spacing
                    
                    # 添加空格
                    x += font_metrics.horizontalAdvance(' ') + self.letter_spacing
                    word_index += 1
            
            # 移动到下一行
            line_y += line_height
            
            # 根据模式处理布局
            if self.generate_mode == '抄写' or self.generate_mode == '描红+抄写':
                # 抄写模式：添加组间距，然后绘制空白行
                line_y += group_gap
                
                # 绘制空白行
                line_renderer.draw_line(painter, rect, line_y)
                
                # 移动到下一组
                line_y += line_height + group_gap
            else:
                # 非抄写模式：直接添加组间距
                line_y += group_gap
        
        # 返回下一个要绘制的单词索引
        return word_index
    
    def save_project(self, file_path=None):
        # 如果没有指定文件路径，弹出保存对话框
        if not file_path and not self.current_file:
            # 获取用户的Documents目录作为默认保存路径
            import os
            documents_path = os.path.expanduser('~/Documents')
            file_path, _ = QFileDialog.getSaveFileName(self, '保存工程', documents_path, '字帖工程文件 (*.zyecb)')
            if not file_path:
                return False
        elif not file_path:
            file_path = self.current_file
        
        # 确保文件扩展名正确
        if not file_path.endswith('.zyecb'):
            file_path += '.zyecb'
        
        # 保存项目数据
        project_data = {
            'text_content': self.text_content,
            'font_size': self.font_size,
            'letter_spacing': self.letter_spacing,
            'position_x': self.position_x,
            'position_y': self.position_y,
            'line_type': self.line_type,
            'generate_mode': self.generate_mode,
            'custom_headers': self.custom_headers,
            'title': self.title,
            'show_page_number': self.show_page_number
        }
        
        # 以二进制模式保存文件
        import pickle
        try:
            with open(file_path, 'wb') as f:
                pickle.dump(project_data, f)
            
            # 更新当前文件路径和修改状态
            self.current_file = file_path
            self.modified = False
            
            return True
        except Exception as e:
            QMessageBox.warning(self, '保存失败', f'保存工程文件失败: {str(e)}')
            return False
    
    def load_project(self, file_path):
        try:
            # 以二进制模式加载文件
            import pickle
            with open(file_path, 'rb') as f:
                project_data = pickle.load(f)
            
            # 加载数据
            self.text_content = project_data.get('text_content', '')
            self.font_size = project_data.get('font_size', 18)  # 默认值改为18
            self.letter_spacing = project_data.get('letter_spacing', 0)
            self.position_x = project_data.get('position_x', 0)
            self.position_y = project_data.get('position_y', 0)
            self.line_type = project_data.get('line_type', '四线三格')
            self.generate_mode = project_data.get('generate_mode', '描红')
            self.custom_headers = project_data.get('custom_headers', [])
            self.title = project_data.get('title', '英文字帖')
            self.show_page_number = project_data.get('show_page_number', True)
            
            # 更新当前文件路径和修改状态
            self.current_file = file_path
            self.modified = False
            
            # 更新UI
            self.text_edit.setText(self.text_content)
            self.font_size_spin.setValue(self.font_size)
            self.spacing_spin.setValue(self.letter_spacing)
            self.x_spin.setValue(self.position_x)
            self.y_spin.setValue(self.position_y)
            self.line_combo.setCurrentText(self.line_type)
            self.mode_combo.setCurrentText(self.generate_mode)
            self.title_edit.setText(self.title)
            self.page_number_checkbox.setChecked(self.show_page_number)
            
            # 更新头部列表
            self.header_list.clear()
            for header in self.custom_headers:
                item = QListWidgetItem(header)
                self.header_list.addItem(item)
            
            # 更新预览
            self.update_preview()
            
            return True
        except Exception as e:
            QMessageBox.warning(self, '加载失败', f'加载工程文件失败: {str(e)}')
            return False
    
    def export_pdf(self):
        # 设置默认文件名
        default_filename = ''
        if self.current_file:
            # 从工程文件名获取默认PDF文件名
            base_name = os.path.basename(self.current_file)
            if base_name.endswith('.zyecb'):
                # 移除.zyecb扩展名，不包括点号
                name_without_ext = os.path.splitext(base_name)[0]
                default_filename = name_without_ext
        
        file_path, _ = QFileDialog.getSaveFileName(self, '导出PDF', default_filename, 'PDF文件 (*.pdf)')
        if file_path:
            # 确保文件扩展名正确
            if not file_path.endswith('.pdf'):
                file_path += '.pdf'
            
            # 创建PDF writer
            writer = QPdfWriter(file_path)
            # 设置页面大小为A4（210mm x 297mm）
            writer.setPageSize(QPageSize(QPageSize.PageSizeId.A4))
            # 设置分辨率为96 DPI，与屏幕一致
            writer.setResolution(96)
            
            # 获取文本内容
            self.text_content = self.text_edit.toPlainText()
            
            # 计算总页数
            total_pages = self.calculate_total_pages()
            
            # 绘制PDF
            painter = QPainter(writer)
            word_index = 0
            
            # 使用与预览相同的尺寸（800x1131），让PDF writer自动处理缩放
            for page in range(total_pages):
                if page > 0:
                    writer.newPage()
                
                # 绘制当前页，使用稍微缩小的尺寸，增加右侧边距
                # 原来的尺寸：QRect(20, 20, 760, 1091)
                # 缩小宽度，增加右侧边距
                rect = QRect(20, 20, 720, 1091)
                word_index = self.draw_copybook(painter, rect, word_index, page, total_pages)
            
            painter.end()
            
            QMessageBox.information(self, '导出成功', 'PDF文件导出成功！')

class CopybookGenerator(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('钟毓英语衡水体字帖生成器')
        self.setGeometry(100, 100, 1000, 800)
        # 设置窗口图标
        # 图标文件直接位于根目录下
        icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app_icon.ico')
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
        
        # 字体设置
        self.font_path = os.path.join('font', '舒窈英文衡水体.ttf')
        self.font_id = QFontDatabase.addApplicationFont(self.font_path)
        self.font_family = QFontDatabase.applicationFontFamilies(self.font_id)[0]
        
        # 初始化参数
        self.tabs = QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.close_tab)
        self.tabs.currentChanged.connect(self.update_window_title)
        
        # 设置标签栏样式，使标签可关闭
        tab_bar = self.tabs.tabBar()
        tab_bar.setTabsClosable(True)
        
        # 创建菜单栏
        self.create_menu_bar()
        
        # 设置中央部件
        self.setCentralWidget(self.tabs)
        
        # 创建第一个标签页
        self.new_project()
        
        # 程序打开后默认最大化
        self.showMaximized()
    
    def update_window_title(self):
        # 更新窗口标题栏
        current_tab = self.tabs.currentWidget()
        if current_tab:
            if current_tab.current_file:
                # 如果有打开的文件，显示文件名
                filename = os.path.basename(current_tab.current_file)
                if current_tab.modified:
                    self.setWindowTitle(f'钟毓英语衡水体字帖生成器 - {filename}*')
                else:
                    self.setWindowTitle(f'钟毓英语衡水体字帖生成器 - {filename}')
            else:
                # 如果没有打开的文件，显示 Untitled
                if current_tab.modified:
                    self.setWindowTitle('钟毓英语衡水体字帖生成器 - Untitled*')
                else:
                    self.setWindowTitle('钟毓英语衡水体字帖生成器 - Untitled')
        else:
            self.setWindowTitle('钟毓英语衡水体字帖生成器')
    
    def new_project(self):
        # 创建新的标签页
        new_tab = CopybookTab(self, self.font_family)
        
        # 连接信号
        new_tab.modified_changed.connect(lambda: self.update_tab_text(new_tab, self.tabs.indexOf(new_tab)))
        
        # 生成新的标签页标题
        title = 'Untitled'
        counter = 1
        while True:
            # 检查是否已存在相同标题的标签页
            exists = False
            for i in range(self.tabs.count()):
                if self.tabs.tabText(i) == title:
                    exists = True
                    break
            if not exists:
                break
            title = f'Untitled{counter}'
            counter += 1
        
        # 添加标签页
        index = self.tabs.addTab(new_tab, title)
        self.tabs.setCurrentIndex(index)
        
        # 更新标签显示
        self.update_tab_text(new_tab, index)
    
    def update_tab_text(self, tab, index):
        # 更新标签页文本
        if tab.current_file:
            filename = os.path.basename(tab.current_file)
            if tab.modified:
                self.tabs.setTabText(index, f'{filename}*')
            else:
                self.tabs.setTabText(index, filename)
        else:
            if tab.modified:
                self.tabs.setTabText(index, 'Untitled*')
            else:
                self.tabs.setTabText(index, 'Untitled')
    
    def close_tab(self, index):
        # 获取要关闭的标签页
        tab = self.tabs.widget(index)
        
        # 检查是否有未保存的内容
        if tab.modified:
            # 显示保存提示对话框
            reply = QMessageBox.question(self, '保存提示', '当前工程未保存，是否保存？',
                                       QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel)
            
            if reply == QMessageBox.StandardButton.Save:
                # 保存当前工程
                if not tab.save_project():
                    return
            elif reply == QMessageBox.StandardButton.Cancel:
                # 取消关闭操作
                return
            # 如果是 Discard，直接继续关闭
        
        # 移除标签页
        self.tabs.removeTab(index)
        tab.deleteLater()
        
        # 更新窗口标题
        self.update_window_title()
    
    def load_project(self):
        file_path, _ = QFileDialog.getOpenFileName(self, '加载工程', '', '字帖工程文件 (*.zyecb)')
        if file_path:
            # 检查当前是否只有一个空白标签页
            if self.tabs.count() == 1 and not self.tabs.widget(0).current_file and not self.tabs.widget(0).modified:
                # 在当前标签页加载
                tab = self.tabs.widget(0)
                # 连接信号
                tab.modified_changed.connect(lambda: self.update_tab_text(tab, 0))
                if tab.load_project(file_path):
                    # 更新标签文本
                    self.update_tab_text(tab, 0)
                    # 更新窗口标题
                    self.update_window_title()
            else:
                # 创建新的标签页
                new_tab = CopybookTab(self, self.font_family)
                # 连接信号
                new_tab.modified_changed.connect(lambda: self.update_tab_text(new_tab, self.tabs.indexOf(new_tab)))
                if new_tab.load_project(file_path):
                    # 添加标签页
                    index = self.tabs.addTab(new_tab, os.path.basename(file_path))
                    self.tabs.setCurrentIndex(index)
                    # 更新标签文本
                    self.update_tab_text(new_tab, index)
                    # 更新窗口标题
                    self.update_window_title()
    
    def save_project(self):
        current_tab = self.tabs.currentWidget()
        if current_tab:
            if current_tab.save_project():
                # 更新标签文本
                index = self.tabs.currentIndex()
                self.update_tab_text(current_tab, index)
                # 更新窗口标题
                self.update_window_title()

    def save_project_as(self):
        current_tab = self.tabs.currentWidget()
        if current_tab:
            # 获取用户的Documents目录作为默认保存路径
            import os
            documents_path = os.path.expanduser('~/Documents')
            file_path, _ = QFileDialog.getSaveFileName(self, '另存为工程', documents_path, '字帖工程文件 (*.zyecb)')
            if file_path:
                if current_tab.save_project(file_path):
                    # 更新标签文本
                    index = self.tabs.currentIndex()
                    self.update_tab_text(current_tab, index)
                    # 更新窗口标题
                    self.update_window_title()
    
    def create_menu_bar(self):
        # 创建菜单栏
        menubar = self.menuBar()
        # 应用主样式
        self.setStyleSheet(Style.main_style())
        
        # 文件菜单
        file_menu = menubar.addMenu('文件(&F)')
        
        # 新建
        new_action = QAction('新建(&N)', self)
        new_action.setShortcut(QKeySequence.StandardKey.New)
        new_action.triggered.connect(self.new_project)
        file_menu.addAction(new_action)
        
        file_menu.addSeparator()
        
        # 打开
        open_action = QAction('打开(&O)', self)
        open_action.setShortcut(QKeySequence.StandardKey.Open)
        open_action.triggered.connect(self.load_project)
        file_menu.addAction(open_action)
        
        # 保存
        save_action = QAction('保存(&S)', self)
        save_action.setShortcut(QKeySequence.StandardKey.Save)
        save_action.triggered.connect(self.save_project)
        file_menu.addAction(save_action)
        
        # 另存为
        save_as_action = QAction('另存为(&A)', self)
        save_as_action.setShortcut(QKeySequence('Ctrl+Shift+S'))
        save_as_action.triggered.connect(self.save_project_as)
        file_menu.addAction(save_as_action)
        
        file_menu.addSeparator()
        
        # 导出PDF
        export_pdf_action = QAction('导出PDF(&E)', self)
        export_pdf_action.setShortcut(QKeySequence('Ctrl+F'))
        export_pdf_action.triggered.connect(self.export_pdf)
        file_menu.addAction(export_pdf_action)
        
        file_menu.addSeparator()
        
        # 关闭
        close_action = QAction('关闭(&C)', self)
        close_action.setShortcut(QKeySequence('Alt+F4'))
        close_action.triggered.connect(self.close)
        file_menu.addAction(close_action)
        
        # 编辑菜单
        edit_menu = menubar.addMenu('编辑(&E)')
        
        # 剪切
        cut_action = QAction('剪切(&T)', self)
        cut_action.setShortcut(QKeySequence.StandardKey.Cut)
        cut_action.triggered.connect(self.cut_text)
        edit_menu.addAction(cut_action)
        
        # 复制
        copy_action = QAction('复制(&C)', self)
        copy_action.setShortcut(QKeySequence.StandardKey.Copy)
        copy_action.triggered.connect(self.copy_text)
        edit_menu.addAction(copy_action)
        
        # 粘贴
        paste_action = QAction('粘贴(&P)', self)
        paste_action.setShortcut(QKeySequence.StandardKey.Paste)
        paste_action.triggered.connect(self.paste_text)
        edit_menu.addAction(paste_action)
        
        # 帮助菜单
        help_menu = menubar.addMenu('帮助(&H)')
        
        # 帮助
        help_action = QAction('帮助(&H)', self)
        help_action.setShortcut(QKeySequence.StandardKey.HelpContents)
        help_action.triggered.connect(self.show_help)
        help_menu.addAction(help_action)
        
        # 用户协议
        agreement_action = QAction('用户协议(&A)', self)
        agreement_action.triggered.connect(self.show_user_agreement)
        help_menu.addAction(agreement_action)
        
        help_menu.addSeparator()
        
        # 关于
        about_action = QAction('关于(&A)', self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
    
    def save_project_as(self):
        current_tab = self.tabs.currentWidget()
        if current_tab:
            file_path, _ = QFileDialog.getSaveFileName(self, '另存为工程', '', '字帖工程文件 (*.zyecb)')
            if file_path:
                if current_tab.save_project(file_path):
                    # 更新标签文本
                    index = self.tabs.currentIndex()
                    self.update_tab_text(current_tab, index)
                    # 更新窗口标题
                    self.update_window_title()
    

    
    def cut_text(self):
        # 剪切文本
        current_tab = self.tabs.currentWidget()
        if current_tab:
            current_tab.text_edit.cut()

    def copy_text(self):
        # 复制文本
        current_tab = self.tabs.currentWidget()
        if current_tab:
            current_tab.text_edit.copy()

    def paste_text(self):
        # 粘贴文本
        current_tab = self.tabs.currentWidget()
        if current_tab:
            current_tab.text_edit.paste()
    
    def show_help(self):
        # 显示帮助
        help_text = '''英文字帖生成器帮助

1. 在左侧文本框中输入要生成字帖的英文内容
2. 设置字体大小、字间距、位置偏移等参数
3. 选择线格类型（四线三格或单横线）
4. 选择生成模式（描红、抄写、描红+抄写、字帖）
5. 点击保存工程可以保存当前设置
6. 点击加载工程可以加载之前保存的设置
7. 点击导出PDF可以将字帖导出为PDF文件
'''
        QMessageBox.information(self, '帮助', help_text)
    
    def show_about(self):
        # 显示关于
        about_text = '''钟毓英语衡水体字帖生成器

版本：1.0.0
作者：泰州姜堰钟毓信息技术有限公司
功能：生成英文字帖，支持多种模式和线格类型
'''
        QMessageBox.information(self, '关于', about_text)
    
    def show_user_agreement(self):
        # 显示用户协议（Apache 2.0 协议）
        dialog = UserAgreementDialog(self)
        dialog.exec()
    
    def closeEvent(self, event):
        # 检查所有标签页是否有未保存的内容
        unsaved_tabs = []
        for i in range(self.tabs.count()):
            tab = self.tabs.widget(i)
            if tab.modified:
                unsaved_tabs.append(i)
        
        # 如果有未保存的标签页，提示用户
        if unsaved_tabs:
            # 按顺序处理未保存的标签页
            for i in reversed(unsaved_tabs):  # 倒序处理，避免索引变化
                tab = self.tabs.widget(i)
                # 显示保存提示对话框
                reply = QMessageBox.question(self, '保存提示', '当前工程未保存，是否保存？',
                                           QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel)
                
                if reply == QMessageBox.StandardButton.Save:
                    # 保存当前工程
                    if not tab.save_project():
                        event.ignore()
                        return
                elif reply == QMessageBox.StandardButton.Cancel:
                    # 取消关闭操作
                    event.ignore()
                    return
                # 如果是 Discard，直接继续关闭
        
        # 所有标签页都已处理，允许关闭窗口
        event.accept()
    
    def create_ui(self):
        # 主布局
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        
        # 中间内容区域
        content_layout = QHBoxLayout()
        main_layout.addLayout(content_layout)
        
        # 左侧设置面板
        settings_panel = QWidget()
        settings_layout = QVBoxLayout(settings_panel)
        content_layout.addWidget(settings_panel, 1)
        
        # 输入文本区域
        text_group = QGroupBox('输入内容')
        text_layout = QVBoxLayout(text_group)
        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText('请输入要生成字帖的英文内容...')
        self.text_edit.textChanged.connect(self.on_text_changed)
        # 增大输入内容的多行文本框的高度
        self.text_edit.setMinimumHeight(150)
        text_layout.addWidget(self.text_edit)
        settings_layout.addWidget(text_group)
        
        # 字体设置和位置调整放在同一组
        adjust_group = QGroupBox('调整设置')
        adjust_layout = QGridLayout(adjust_group)
        
        # 字体大小和字间距放到一行
        font_size_label = QLabel('字体大小:')
        self.font_size_spin = QSpinBox()
        self.font_size_spin.setRange(10, 50)
        self.font_size_spin.setValue(self.font_size)
        self.font_size_spin.valueChanged.connect(self.update_font_size)
        adjust_layout.addWidget(font_size_label, 0, 0)
        adjust_layout.addWidget(self.font_size_spin, 0, 1)
        
        spacing_label = QLabel('字间距:')
        self.spacing_spin = QSpinBox()
        self.spacing_spin.setRange(-10, 20)
        self.spacing_spin.setValue(self.letter_spacing)
        self.spacing_spin.valueChanged.connect(self.update_spacing)
        adjust_layout.addWidget(spacing_label, 0, 2)
        adjust_layout.addWidget(self.spacing_spin, 0, 3)
        
        # X轴偏移和Y轴偏移放到一行
        x_label = QLabel('X轴偏移:')
        self.x_spin = QSpinBox()
        self.x_spin.setRange(-50, 50)
        self.x_spin.setValue(self.position_x)
        self.x_spin.valueChanged.connect(self.update_position)
        adjust_layout.addWidget(x_label, 1, 0)
        adjust_layout.addWidget(self.x_spin, 1, 1)
        
        y_label = QLabel('Y轴偏移:')
        self.y_spin = QSpinBox()
        self.y_spin.setRange(-50, 50)
        self.y_spin.setValue(self.position_y)
        self.y_spin.valueChanged.connect(self.update_position)
        adjust_layout.addWidget(y_label, 1, 2)
        adjust_layout.addWidget(self.y_spin, 1, 3)
        
        settings_layout.addWidget(adjust_group)
        
        # 线格类型
        line_group = QGroupBox('线格类型')
        line_layout = QVBoxLayout(line_group)
        self.line_combo = QComboBox()
        self.line_combo.addItems(['四线三格', '单横线'])
        self.line_combo.currentTextChanged.connect(self.update_line_type)
        line_layout.addWidget(self.line_combo)
        settings_layout.addWidget(line_group)
        
        # 生成模式
        mode_group = QGroupBox('生成模式')
        mode_layout = QVBoxLayout(mode_group)
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(['描红', '抄写', '描红+抄写', '字帖'])
        self.mode_combo.currentTextChanged.connect(self.update_generate_mode)
        mode_layout.addWidget(self.mode_combo)
        settings_layout.addWidget(mode_group)
        
        # 标题设置
        title_group = QGroupBox('标题设置')
        title_layout = QVBoxLayout(title_group)
        title_label = QLabel('字帖标题:')
        self.title_edit = QLineEdit()
        self.title_edit.setText(self.title)
        self.title_edit.textChanged.connect(self.update_title)
        title_layout.addWidget(title_label)
        title_layout.addWidget(self.title_edit)
        
        # 添加页码显示选项
        self.page_number_checkbox = QCheckBox('显示页码')
        self.page_number_checkbox.setChecked(self.show_page_number)
        self.page_number_checkbox.stateChanged.connect(self.update_show_page_number)
        title_layout.addWidget(self.page_number_checkbox)
        
        settings_layout.addWidget(title_group)
        
        # 自定义头部
        header_group = QGroupBox('自定义头部')
        header_layout = QVBoxLayout(header_group)
        
        header_buttons_layout = QHBoxLayout()
        add_header_button = QPushButton('添加字段')
        add_header_button.clicked.connect(self.add_header)
        remove_header_button = QPushButton('删除字段')
        remove_header_button.clicked.connect(self.remove_header)
        header_buttons_layout.addWidget(add_header_button)
        header_buttons_layout.addWidget(remove_header_button)
        header_layout.addLayout(header_buttons_layout)
        
        self.header_list = QListWidget()
        # 添加初始化的自定义字段
        for header in self.custom_headers:
            item = QListWidgetItem(header)
            self.header_list.addItem(item)
        # 减小自定义头部的高度
        self.header_list.setMaximumHeight(80)
        header_layout.addWidget(self.header_list)
        settings_layout.addWidget(header_group)
        
        # 右侧预览区域
        preview_panel = QWidget()
        preview_layout = QVBoxLayout(preview_panel)
        content_layout.addWidget(preview_panel, 2)
        
        preview_label = QLabel('预览效果')
        preview_layout.addWidget(preview_label)
        
        # 翻页控制
        page_control_layout = QHBoxLayout()
        
        # 创建上一页按钮，使用图标
        self.prev_button = QPushButton()
        # 只设置文本作为箭头图标
        self.prev_button.setText('←')
        self.prev_button.setFixedSize(40, 30)  # 设置按钮大小
        self.prev_button.clicked.connect(self.prev_page)
        self.prev_button.setEnabled(False)
        page_control_layout.addWidget(self.prev_button)
        
        # 添加伸缩空间，使页码居中
        page_control_layout.addStretch()
        
        self.page_label = QLabel('第 1 页 / 共 1 页')
        page_control_layout.addWidget(self.page_label)
        
        # 添加伸缩空间，使页码居中
        page_control_layout.addStretch()
        
        # 创建下一页按钮，使用图标
        self.next_button = QPushButton()
        # 只设置文本作为箭头图标
        self.next_button.setText('→')
        self.next_button.setFixedSize(40, 30)  # 设置按钮大小
        self.next_button.clicked.connect(self.next_page)
        self.next_button.setEnabled(False)
        page_control_layout.addWidget(self.next_button)
        
        # 为翻页按钮添加快捷键
        from PyQt6.QtGui import QShortcut, QKeySequence
        QShortcut(QKeySequence('PageUp'), self, self.prev_page)
        QShortcut(QKeySequence('PageDown'), self, self.next_page)
        
        preview_layout.addLayout(page_control_layout)
        
        self.preview_scroll = QScrollArea()
        self.preview_widget = QWidget()
        # 设置对象名称，用于样式选择器
        self.preview_widget.setObjectName("preview_widget")
        self.preview_layout = QVBoxLayout(self.preview_widget)
        self.preview_scroll.setWidget(self.preview_widget)
        self.preview_scroll.setWidgetResizable(True)
        preview_layout.addWidget(self.preview_scroll)
        
        # 初始预览
        self.update_preview()
    
    def update_font_size(self, value):
        self.font_size = value
        self.update_preview()
    
    def update_spacing(self, value):
        self.letter_spacing = value
        self.update_preview()
    
    def update_position(self):
        self.position_x = self.x_spin.value()
        self.position_y = self.y_spin.value()
        self.update_preview()
    
    def update_line_type(self, text):
        self.line_type = text
        self.update_preview()
    
    def update_generate_mode(self, text):
        self.generate_mode = text
        print(f"模式切换为: {text}")  # 添加调试信息
        self.update_preview()
    
    def update_title(self, text):
        self.title = text
        self.update_preview()
    
    def update_show_page_number(self, state):
        self.show_page_number = state == Qt.CheckState.Checked
        self.update_preview()
    
    def add_header(self):
        # 检查自定义字段是否已达到上限
        if len(self.custom_headers) >= 3:
            QMessageBox.warning(self, '添加字段失败', '自定义字段最多只能有3个！')
            return
        
        text, ok = QInputDialog.getText(self, '添加字段', '请输入字段名称:')
        if ok and text:
            self.custom_headers.append(text)
            item = QListWidgetItem(text)
            self.header_list.addItem(item)
            self.update_preview()
    
    def remove_header(self):
        selected_items = self.header_list.selectedItems()
        if selected_items:
            for item in selected_items:
                text = item.text()
                if text in self.custom_headers:
                    self.custom_headers.remove(text)
                self.header_list.takeItem(self.header_list.row(item))
            self.update_preview()
    
    def update_preview(self):
        # 清空预览区域
        for i in reversed(range(self.preview_layout.count())):
            widget = self.preview_layout.itemAt(i).widget()
            if widget:
                widget.deleteLater()
        
        # 获取文本内容
        self.text_content = self.text_edit.toPlainText()
        
        # 计算总页数
        self.total_pages = self.calculate_total_pages()
        
        # 更新页码显示
        self.page_label.setText(f'第 {self.current_page + 1} 页 / 共 {self.total_pages} 页')
        self.prev_button.setEnabled(self.current_page > 0)
        self.next_button.setEnabled(self.current_page < self.total_pages - 1)
        
        # 计算当前页的起始单词索引
        word_index = self.calculate_word_index_for_page(self.current_page)
        
        # 创建预览画布
        preview_pixmap = QPixmap(800, 1131)  # A4纸比例
        preview_pixmap.fill(Qt.GlobalColor.white)
        
        # 绘制预览
        painter = QPainter(preview_pixmap)
        self.draw_copybook(painter, QRect(20, 20, 760, 1091), word_index, self.current_page, self.total_pages)
        painter.end()
        
        # 显示预览
        preview_label = QLabel()
        preview_label.setPixmap(preview_pixmap)
        preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_layout.addWidget(preview_label)
    
    def calculate_total_pages(self):
        # 计算总页数
        return calculate_total_pages(
            self.text_content, 
            self.font_size, 
            self.letter_spacing, 
            self.generate_mode
        )
    
    def calculate_word_index_for_page(self, page):
        # 计算指定页的起始单词索引
        return calculate_word_index_for_page(
            page, 
            self.text_content, 
            self.font_size, 
            self.letter_spacing, 
            self.generate_mode
        )
    
    def prev_page(self):
        if self.current_page > 0:
            self.current_page -= 1
            self.update_preview()
    
    def next_page(self):
        if self.current_page < self.total_pages - 1:
            self.current_page += 1
            self.update_preview()
    
    def draw_copybook(self, painter, rect, word_index=0, current_page=0, total_pages=1):
        # 绘制头部
        self.draw_header(painter, rect)
        
        # 计算内容区域
        header_height = 100
        content_rect = QRect(rect.left(), rect.top() + header_height, rect.width(), rect.height() - header_height)
        
        # 绘制线格和文字
        word_index = self.draw_lines_and_text(painter, content_rect, word_index)
        
        # 绘制页码
        if self.show_page_number:
            # 设置页码字体
            page_font = QFont(self.font_family, 12)
            painter.setFont(page_font)
            painter.setPen(QPen(Qt.GlobalColor.gray))
            
            # 计算页码位置（底部居中）
            page_text = f'第 {current_page + 1} 页 / 共 {total_pages} 页'
            page_rect = QRect(rect.left(), rect.bottom() - 30, rect.width(), 20)
            painter.drawText(page_rect, Qt.AlignmentFlag.AlignCenter, page_text)
        
        return word_index
    
    def draw_header(self, painter, rect):
        # 设置标题字体（粗体，字号增大）
        title_font = QFont(self.font_family, 18)
        title_font.setBold(True)
        painter.setFont(title_font)
        
        # 显式设置标题颜色为黑色
        painter.setPen(QPen(Qt.GlobalColor.black))
        
        # 绘制标题（居中显示）
        title_rect = QRect(rect.left(), rect.top(), rect.width(), 50)
        painter.drawText(title_rect, Qt.AlignmentFlag.AlignCenter, self.title)
        
        # 设置字段字体
        field_font = QFont(self.font_family, 12)
        painter.setFont(field_font)
        
        # 绘制自定义字段（新行显示，居中）
        if self.custom_headers:
            # 计算每个字段的宽度
            field_width = 200
            total_width = field_width * len(self.custom_headers)
            # 计算起始 x 坐标，使得整个字段行居中
            start_x = rect.left() + (rect.width() - total_width) // 2
            # 增加与标题行之间的间距
            field_y = rect.top() + 80  # 从 60 改为 80，增加 20 的间距
            # 绘制每个字段
            for i, header in enumerate(self.custom_headers):
                x_offset = start_x + i * field_width
                painter.drawText(x_offset, field_y, f'{header}: _______________')
    
    def draw_lines_and_text(self, painter, rect, word_index=0):
        # 重新设计绘制逻辑，使用分支结构处理不同模式的布局
        
        # 计算线的参数
        if self.line_type == '四线三格':
            line_height = 40  # 每行的高度
            group_gap = 40  # 组之间的间距
        else:  # 单横线模式
            line_height = 30  # 单横线模式下的行高，确保所有线间距相同
            group_gap = 0  # 单横线模式下不需要组间距
        
        # 计算文字区域
        text_left = rect.left() + 10 + self.position_x
        # 根据线格类型设置不同的Y轴偏移
        if self.line_type == '四线三格':
            text_y_offset = self.position_y - 4
        else:  # 单横线模式
            text_y_offset = self.position_y - 20
        line_width = rect.width() - 30
        
        # 设置字体
        font = QFont(self.font_family, self.font_size)
        painter.setFont(font)
        
        # 获取字体度量信息，用于计算字符宽度
        font_metrics = painter.fontMetrics()
        
        # 创建线格渲染器
        if self.line_type == '四线三格':
            line_renderer = FourLineGrid()
        else:
            line_renderer = SingleLine()
        
        # 将文本分割成单词列表
        words = []
        lines = self.text_content.split('\n')
        for line in lines:
            line_words = line.split(' ')
            # 保留行首的空格
            leading_spaces = 0
            for i, word in enumerate(line_words):
                if not word:
                    leading_spaces += 1
                else:
                    break
            # 添加行首空格作为一个特殊单词
            if leading_spaces > 0:
                words.append(' ' * leading_spaces)
            # 添加非空单词
            for word in line_words[leading_spaces:]:
                if word:
                    words.append(word)
            words.append('\n')  # 添加换行标记
        
        # 绘制线和文字
        line_y = rect.top() + 20
        
        # 绘制直到页面底部
        while line_y < rect.bottom() - 100:
            # 设置颜色
            if self.generate_mode in ['描红', '描红+抄写']:
                text_color = QColor(255, 100, 100)  # 淡红色
            else:
                text_color = QColor(0, 0, 0)  # 黑色
            
            # 绘制文字行
            line_renderer.draw_line(painter, rect, line_y)
            
            # 绘制文字（文字位置受Y轴偏移影响）
            if word_index < len(words):
                x = text_left
                painter.setPen(QPen(text_color))
                
                # 计算文字的Y坐标，根据线格类型调整
                if self.line_type == '四线三格':
                    text_y = line_y + 30 + text_y_offset
                else:  # 单横线模式
                    text_y = line_y + 20 + text_y_offset
                
                # 在当前行绘制单词，直到行满或遇到换行标记
                while word_index < len(words):
                    word = words[word_index]
                    
                    # 遇到换行标记，移动到下一行
                    if word == '\n':
                        word_index += 1
                        break
                    
                    # 计算单词宽度
                    word_width = 0
                    for char in word:
                        word_width += font_metrics.horizontalAdvance(char) + self.letter_spacing
                    
                    # 如果当前行放不下这个单词，移动到下一行
                    if x + word_width > text_left + line_width and x > text_left:
                        break
                    
                    # 绘制单词
                    for char in word:
                        if x > text_left + line_width:
                            break
                        painter.drawText(x, text_y, char)
                        x += font_metrics.horizontalAdvance(char) + self.letter_spacing
                    
                    # 添加空格
                    x += font_metrics.horizontalAdvance(' ') + self.letter_spacing
                    word_index += 1
            
            # 移动到下一行
            line_y += line_height
            
            # 根据模式处理布局
            if self.generate_mode == '抄写' or self.generate_mode == '描红+抄写':
                # 抄写模式：添加组间距，然后绘制空白行
                line_y += group_gap
                
                # 绘制空白行
                line_renderer.draw_line(painter, rect, line_y)
                
                # 移动到下一组
                line_y += line_height + group_gap
            else:
                # 非抄写模式：直接添加组间距
                line_y += group_gap
        
        # 返回下一个要绘制的单词索引
        return word_index
    

    


    def export_pdf(self):
        current_tab = self.tabs.currentWidget()
        if current_tab:
            current_tab.export_pdf()

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = CopybookGenerator()
    # 处理命令行参数，打开.zyecb文件
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        if file_path.endswith('.zyecb'):
            # 检查当前是否只有一个空白标签页
            if window.tabs.count() == 1 and not window.tabs.widget(0).current_file and not window.tabs.widget(0).modified:
                # 在当前标签页加载
                tab = window.tabs.widget(0)
                # 连接信号
                tab.modified_changed.connect(lambda: window.update_tab_text(tab, 0))
                if tab.load_project(file_path):
                    # 更新标签文本
                    window.update_tab_text(tab, 0)
                    # 更新窗口标题
                    window.update_window_title()
            else:
                # 创建新的标签页
                new_tab = CopybookTab(window, window.font_family)
                # 连接信号
                new_tab.modified_changed.connect(lambda: window.update_tab_text(new_tab, window.tabs.indexOf(new_tab)))
                if new_tab.load_project(file_path):
                    # 添加标签页
                    index = window.tabs.addTab(new_tab, os.path.basename(file_path))
                    window.tabs.setCurrentIndex(index)
                    # 更新标签文本
                    window.update_tab_text(new_tab, index)
                    # 更新窗口标题
                    window.update_window_title()
    window.show()
    sys.exit(app.exec())