# 模仿 tailwindcss 的样式定义

class Style:
    """样式类"""
    
    # 颜色
    PRIMARY_COLOR = '#3b82f6'  # 蓝色
    SECONDARY_COLOR = '#6b7280'  # 灰色
    SUCCESS_COLOR = '#10b981'  # 绿色
    DANGER_COLOR = '#ef4444'  # 红色
    WARNING_COLOR = '#f59e0b'  # 黄色
    
    # 背景色
    BG_WHITE = '#ffffff'
    BG_GRAY = '#f3f4f6'
    BG_LIGHT = '#f9fafb'
    
    # 文字颜色
    TEXT_DARK = '#111827'
    TEXT_GRAY = '#4b5563'
    TEXT_LIGHT = '#9ca3af'
    
    # 边框
    BORDER_COLOR = '#e5e7eb'
    BORDER_RADIUS = 4
    
    # 字体
    FONT_FAMILY = 'Arial, sans-serif'
    
    # 间距
    SPACING_1 = 4
    SPACING_2 = 8
    SPACING_3 = 12
    SPACING_4 = 16
    SPACING_5 = 20
    SPACING_6 = 24
    SPACING_8 = 32
    SPACING_10 = 40
    
    # 按钮样式
    @staticmethod
    def button_style():
        """按钮样式"""
        return {
            'background-color': Style.PRIMARY_COLOR,
            'color': Style.BG_WHITE,
            'border': f'1px solid {Style.PRIMARY_COLOR}',
            'border-radius': f'{Style.BORDER_RADIUS}px',
            'padding': f'{Style.SPACING_2}px {Style.SPACING_4}px',
            'font-family': Style.FONT_FAMILY,
            'font-size': '14px',
            'cursor': 'pointer'
        }
    
    @staticmethod
    def button_hover_style():
        """按钮悬停样式"""
        return {
            'background-color': '#2563eb',  # 稍深的蓝色
            'border-color': '#2563eb'
        }
    
    # 输入框样式
    @staticmethod
    def input_style():
        """输入框样式"""
        return {
            'border': f'1px solid {Style.BORDER_COLOR}',
            'border-radius': f'{Style.BORDER_RADIUS}px',
            'padding': f'{Style.SPACING_2}px {Style.SPACING_3}px',
            'font-family': Style.FONT_FAMILY,
            'font-size': '14px',
            'color': Style.TEXT_DARK,
            'background-color': Style.BG_WHITE
        }
    
    @staticmethod
    def input_focus_style():
        """输入框聚焦样式"""
        return {
            'border-color': Style.PRIMARY_COLOR,
            'outline': f'2px solid {Style.PRIMARY_COLOR}33'  # 带透明度的蓝色
        }
    
    # 标签样式
    @staticmethod
    def label_style():
        """标签样式"""
        return {
            'font-family': Style.FONT_FAMILY,
            'font-size': '14px',
            'font-weight': '500',
            'color': Style.TEXT_DARK,
            'margin-bottom': f'{Style.SPACING_2}px'
        }
    
    # 分组框样式
    @staticmethod
    def group_box_style():
        """分组框样式"""
        return {
            'border': f'1px solid {Style.BORDER_COLOR}',
            'border-radius': f'{Style.BORDER_RADIUS}px',
            'background-color': Style.BG_LIGHT,
            'margin-bottom': f'{Style.SPACING_4}px'
        }
    
    # 分组框标题样式
    @staticmethod
    def group_box_title_style():
        """分组框标题样式"""
        return {
            'font-family': Style.FONT_FAMILY,
            'font-size': '16px',
            'font-weight': '600',
            'color': Style.TEXT_DARK,
            'padding': f'{Style.SPACING_2}px {Style.SPACING_3}px'
        }
    
    # 主窗口样式
    @staticmethod
    def main_window_style():
        """主窗口样式"""
        return {
            'background-color': Style.BG_GRAY
        }
    
    # 菜单样式
    @staticmethod
    def menu_style():
        """菜单样式"""
        return f"""
        QMenuBar {{
            background-color: {Style.BG_WHITE};
            border: 1px solid {Style.BORDER_COLOR};
        }}
        
        QMenuBar::item {{
            background-color: {Style.BG_WHITE};
            color: {Style.TEXT_DARK};
            padding: 8px 12px;
            font-family: {Style.FONT_FAMILY};
        }}
        
        QMenuBar::item:selected {{
            background-color: {Style.PRIMARY_COLOR};
            color: {Style.BG_WHITE};
        }}
        
        QMenu {{
            background-color: {Style.BG_WHITE};
            border: 1px solid {Style.BORDER_COLOR};
            font-family: {Style.FONT_FAMILY};
        }}
        
        QMenu::item {{
            background-color: {Style.BG_WHITE};
            color: {Style.TEXT_DARK};
            padding: 6px 20px;
        }}
        
        QMenu::item:selected {{
            background-color: {Style.PRIMARY_COLOR};
            color: {Style.BG_WHITE};
        }}
        """
    
    # 主样式
    @staticmethod
    def main_style():
        """主样式"""
        return f"""
        /* 主窗口样式 */
        QWidget {{
            background-color: {Style.BG_GRAY};
        }}
        
        /* 分组框样式 */
        QGroupBox {{
            border: 1px solid {Style.BORDER_COLOR};
            border-radius: {Style.BORDER_RADIUS}px;
            background-color: {Style.BG_LIGHT};
            margin-top: 15px; /* 为标题留出空间 */
        }}
        
        /* 分组框标题样式 */
        QGroupBox::title {{
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 10px;
            background-color: {Style.BG_LIGHT};
            margin-left: 10px;
        }}
        
        /* 标签样式 */
        QLabel {{
            font-family: {Style.FONT_FAMILY};
            font-size: 14px;
            font-weight: 500;
            color: {Style.TEXT_DARK};
        }}
        
        /* 输入框样式 */
        QTextEdit, QLineEdit, QSpinBox, QComboBox, QListWidget {{
            border: 1px solid {Style.BORDER_COLOR};
            border-radius: {Style.BORDER_RADIUS}px;
            padding: {Style.SPACING_2}px;
            font-family: {Style.FONT_FAMILY};
            background-color: {Style.BG_WHITE};
        }}
        
        /* 按钮样式 */
        QPushButton {{
            background-color: {Style.PRIMARY_COLOR};
            color: {Style.BG_WHITE};
            border: 1px solid {Style.PRIMARY_COLOR};
            border-radius: {Style.BORDER_RADIUS}px;
            padding: {Style.SPACING_2}px {Style.SPACING_4}px;
            font-family: {Style.FONT_FAMILY};
            font-size: 14px;
        }}
        
        QPushButton:hover {{
            background-color: #2563eb;
            border-color: #2563eb;
        }}
        
        /* 复选框样式 */
        QCheckBox {{
            font-family: {Style.FONT_FAMILY};
            font-size: 14px;
            color: {Style.TEXT_DARK};
        }}
        
        /* 滚动区域样式 */
        QScrollArea {{
            border: none;
        }}
        
        /* 预览区域样式 */
        #preview_widget {{
            background-color: {Style.BG_WHITE};
            border: 1px solid {Style.BORDER_COLOR};
            border-radius: {Style.BORDER_RADIUS}px;
            padding: {Style.SPACING_4}px;
        }}
        
        /* 菜单样式 */
        QMenuBar {{
            background-color: {Style.BG_WHITE};
            border: 1px solid {Style.BORDER_COLOR};
        }}
        
        QMenuBar::item {{
            background-color: {Style.BG_WHITE};
            color: {Style.TEXT_DARK};
            padding: 8px 12px;
            font-family: {Style.FONT_FAMILY};
        }}
        
        QMenuBar::item:selected {{
            background-color: {Style.PRIMARY_COLOR};
            color: {Style.BG_WHITE};
        }}
        
        QMenu {{
            background-color: {Style.BG_WHITE};
            border: 1px solid {Style.BORDER_COLOR};
            font-family: {Style.FONT_FAMILY};
        }}
        
        QMenu::item {{
            background-color: {Style.BG_WHITE};
            color: {Style.TEXT_DARK};
            padding: 6px 20px;
        }}
        
        QMenu::item:selected {{
            background-color: {Style.PRIMARY_COLOR};
            color: {Style.BG_WHITE};
        }}
        """
