from PyQt6.QtGui import QFont, QFontMetrics


def calculate_total_pages(text_content, font_size, letter_spacing, generate_mode, font_family='Arial'):
    """计算总页数"""
    if not text_content:
        return 1
    
    # 将文本分割成单词列表
    words = []
    lines = text_content.split('\n')
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
    
    # 模拟绘制，计算需要的页数
    total_pages = 1
    word_index = 0
    text_left = 10  # 简化计算，不考虑position_x
    line_width = 760 - 30  # rect.width() - 30
    
    # 创建字体对象，用于获取字体度量信息
    font = QFont(font_family, font_size)
    font_metrics = QFontMetrics(font)
    
    # 计算线的参数（使用四线三格的参数，因为它是默认值）
    line_height = 40  # 每行的高度
    group_gap = 40  # 组之间的间距
    
    while word_index < len(words):
        # 模拟一页的绘制
        line_y = 20  # rect.top() + 20
        page_height = 1091 - 100 - 100  # rect.height() - header_height - bottom_margin
        
        while line_y < page_height and word_index < len(words):
            # 模拟一行能容纳多少单词
            x = text_left
            
            while word_index < len(words):
                word = words[word_index]
                
                # 遇到换行标记，强制换行
                if word == '\n':
                    word_index += 1
                    break
                
                # 精确计算单词宽度，与draw_lines_and_text方法一致
                word_width = 0
                for char in word:
                    word_width += font_metrics.horizontalAdvance(char) + letter_spacing
                space_width = font_metrics.horizontalAdvance(' ') + letter_spacing
                
                # 如果当前行放不下这个单词，换行
                if x + word_width > text_left + line_width and x > text_left:
                    break
                
                # 消耗这个单词
                x += word_width + space_width
                word_index += 1
            
            # 移动到下一行
            line_y += line_height
            
            # 模拟抄写模式
            if generate_mode == '抄写' or generate_mode == '描红+抄写':
                # 抄写模式：添加组间距，然后绘制空白行
                line_y += group_gap
                # 绘制空白行
                line_y += line_height
                # 移动到下一组
                line_y += group_gap
            else:
                # 非抄写模式：直接添加组间距
                line_y += group_gap
        
        # 如果还有单词，需要新的一页
        if word_index < len(words):
            total_pages += 1
    
    return total_pages

def calculate_word_index_for_page(page, text_content, font_size, letter_spacing, generate_mode, font_family='Arial'):
    """计算指定页的起始单词索引"""
    if not text_content or page == 0:
        return 0
    
    # 将文本分割成单词列表
    words = []
    lines = text_content.split('\n')
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
    
    # 模拟绘制，找到指定页的起始单词索引
    word_index = 0
    text_left = 10  # 简化计算，不考虑position_x
    line_width = 760 - 30  # rect.width() - 30
    
    # 创建字体对象，用于获取字体度量信息
    font = QFont(font_family, font_size)
    font_metrics = QFontMetrics(font)
    
    # 计算线的参数（使用四线三格的参数，因为它是默认值）
    line_height = 40  # 每行的高度
    group_gap = 40  # 组之间的间距
    
    for p in range(page):
        line_y = 20  # rect.top() + 20
        page_height = 1091 - 100 - 100  # rect.height() - header_height - bottom_margin
        
        while line_y < page_height and word_index < len(words):
            # 模拟一行能容纳多少单词
            x = text_left
            
            while word_index < len(words):
                word = words[word_index]
                
                # 遇到换行标记，强制换行
                if word == '\n':
                    word_index += 1
                    break
                
                # 精确计算单词宽度，与draw_lines_and_text方法一致
                word_width = 0
                for char in word:
                    word_width += font_metrics.horizontalAdvance(char) + letter_spacing
                space_width = font_metrics.horizontalAdvance(' ') + letter_spacing
                
                # 如果当前行放不下这个单词，换行
                if x + word_width > text_left + line_width and x > text_left:
                    break
                
                # 消耗这个单词
                x += word_width + space_width
                word_index += 1
            
            # 移动到下一行
            line_y += line_height
            
            # 模拟抄写模式
            if generate_mode == '抄写' or generate_mode == '描红+抄写':
                # 抄写模式：添加组间距，然后绘制空白行
                line_y += group_gap
                # 绘制空白行
                line_y += line_height
                # 移动到下一组
                line_y += group_gap
            else:
                # 非抄写模式：直接添加组间距
                line_y += group_gap
    
    return word_index
