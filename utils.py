def calculate_total_pages(text_content, font_size, letter_spacing, generate_mode):
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
    
    while word_index < len(words):
        # 模拟一页的绘制
        line_y = 20  # rect.top() + 20
        page_height = 1091 - 100 - 100  # rect.height() - header_height - bottom_margin
        
        while line_y < page_height and word_index < len(words):
            # 模拟一行能容纳多少单词
            x = text_left
            words_in_line = 0
            
            while word_index < len(words):
                word = words[word_index]
                
                # 遇到换行标记，强制换行
                if word == '\n':
                    word_index += 1
                    break
                
                # 估算单词宽度（简化计算）
                word_width = len(word) * (font_size * 0.6) + letter_spacing * len(word)
                space_width = font_size * 0.6 + letter_spacing
                
                # 如果当前行放不下这个单词，换行
                if x + word_width > text_left + line_width and x > text_left:
                    break
                
                # 消耗这个单词
                x += word_width + space_width
                word_index += 1
                words_in_line += 1
            
            # 移动到下一行
            line_y += 40  # line_height
            
            # 模拟抄写模式
            if generate_mode == '抄写' or generate_mode == '描红+抄写':
                # 抄写模式：添加组间距，然后绘制空白行
                line_y += 40  # group_gap
                # 绘制空白行
                line_y += 40  # line_height
                # 移动到下一组
                line_y += 40  # group_gap
            else:
                # 非抄写模式：直接添加组间距
                line_y += 40  # group_gap
        
        # 如果还有单词，需要新的一页
        if word_index < len(words):
            total_pages += 1
    
    return total_pages

def calculate_word_index_for_page(page, text_content, font_size, letter_spacing, generate_mode):
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
    
    for p in range(page):
        line_y = 20  # rect.top() + 20
        page_height = 1091 - 100 - 100  # rect.height() - header_height - bottom_margin
        
        while line_y < page_height and word_index < len(words):
            # 模拟一行能容纳多少单词
            x = text_left
            words_in_line = 0
            
            while word_index < len(words):
                word = words[word_index]
                
                # 遇到换行标记，强制换行
                if word == '\n':
                    word_index += 1
                    break
                
                # 估算单词宽度（简化计算）
                word_width = len(word) * (font_size * 0.6) + letter_spacing * len(word)
                space_width = font_size * 0.6 + letter_spacing
                
                # 如果当前行放不下这个单词，换行
                if x + word_width > text_left + line_width and x > text_left:
                    break
                
                # 消耗这个单词
                x += word_width + space_width
                word_index += 1
                words_in_line += 1
            
            # 移动到下一行
            line_y += 40  # line_height
            
            # 模拟抄写模式
            if generate_mode == '抄写' or generate_mode == '描红+抄写':
                # 抄写模式：添加组间距，然后绘制空白行
                line_y += 40  # group_gap
                # 绘制空白行
                line_y += 40  # line_height
                # 移动到下一组
                line_y += 40  # group_gap
            else:
                # 非抄写模式：直接添加组间距
                line_y += 40  # group_gap
    
    return word_index
