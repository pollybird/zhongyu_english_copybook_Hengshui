from PyQt6.QtGui import QPainter, QPen
from PyQt6.QtCore import Qt, QRect

class LineRenderer:
    """线格渲染基类"""
    def draw_line(self, painter, rect, y):
        """绘制线格"""
        pass

class FourLineGrid(LineRenderer):
    """四线三格渲染器"""
    def draw_line(self, painter, rect, y):
        """绘制四线三格"""
        painter.setPen(QPen(Qt.GlobalColor.lightGray))
        painter.drawLine(rect.left(), y, rect.right(), y)
        painter.drawLine(rect.left(), y + 13, rect.right(), y + 13)
        painter.drawLine(rect.left(), y + 26, rect.right(), y + 26)
        painter.drawLine(rect.left(), y + 39, rect.right(), y + 39)

class SingleLine(LineRenderer):
    """单横线渲染器"""
    def draw_line(self, painter, rect, y):
        """绘制单横线"""
        painter.setPen(QPen(Qt.GlobalColor.lightGray))
        painter.drawLine(rect.left(), y, rect.right(), y)
