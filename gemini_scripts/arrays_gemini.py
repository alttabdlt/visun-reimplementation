from manim import *

class ArraysInDSA(Scene):
    def construct(self):
        # Color Palette
        blue = "#2980B9"
        green = "#27AE60"
        orange = "#F39C12"
        red = "#E74C3C"
        dark_blue = "#34495E"

        # 1. Introduction (7 seconds)
        title = Text("Arrays in DSA", font="Open Sans", color=blue).scale(1.2)
        definition = Text("A collection of elements of the same data type.", font="Open Sans", color=green).scale(0.7)
        definition2 = Text("Stored in contiguous memory locations.", font="Open Sans", color=green).scale(0.7).next_to(definition, DOWN)
        array_example = Rectangle(width=4, height=1, color=orange)  # Simple array representation
        self.play(Write(title)) # Writing the title
        self.wait(1)
        self.play(Transform(title, definition)) # Transforming the title into definition
        self.play(FadeIn(definition2)) # Fading in the second line of definition
        self.wait(1)
        self.play(Create(array_example)) # Creating the simple array representation
        self.wait(1)

        annotation1 = MarkupText("Arrays: Organized Data Structures", color=dark_blue).to_edge(DOWN)
        self.play(Write(annotation1)) # Writing the annotation
        self.wait(2)
        self.play(FadeOut(title, definition2, array_example, annotation1)) # Fading out the Intro Scene

        # 2. Concept Explanation (25 seconds)
        array_box = Rectangle(width=6, height=1, color=blue) # Array Box
        self.play(Create(array_box))  # Creating the array box.

        elements = ["10", "20", "30", "40", "50"]
        element_texts = VGroup(*[Text(element, font="Open Sans", color=green).scale(0.7) for element in elements]).arrange(RIGHT, buff=0.8)
        element_texts.move_to(array_box.get_center()) # Positioning Elements within the array box.

        indices = ["0", "1", "2", "3", "4"]
        index_texts = VGroup(*[Text(index, font="Open Sans", color=orange).scale(0.6) for index in indices]).arrange(RIGHT, buff=0.8)
        index_texts.next_to(array_box, DOWN) # Indices at the bottom

        self.play(Write(element_texts)) # Writing the elements
        self.play(Write(index_texts))   #Writing the indices

        element_label = Text("Elements", font="Open Sans", color=green).scale(0.6).to_corner(UL)
        index_label = Text("Index", font="Open Sans", color=orange).scale(0.6).next_to(element_label, DOWN)
        contiguous_label = Text("Contiguous Memory", font="Open Sans", color=blue).scale(0.6).to_corner(UR)

        self.play(Write(element_label), Write(index_label), Write(contiguous_label)) # Writing the labels
        self.wait(1)

        #Misconceptions and Corrections
        misconception1 = Text("Arrays can store elements of different datatypes. (Incorrect)", font="Open Sans", color=red).scale(0.5).to_edge(DL)
        self.play(Write(misconception1))
        self.wait(1)
        self.play(FadeOut(misconception1))
        correction1 = Text("Arrays store same datatype", font="Open Sans", color=green).scale(0.5).to_edge(DL)
        self.play(Write(correction1))
        self.wait(1)
        self.play(FadeOut(correction1))

        misconception2 = Text("Array index starts from 1. (Incorrect)", font="Open Sans", color=red).scale(0.5).to_edge(DL)
        self.play(Write(misconception2))
        self.wait(1)
        self.play(FadeOut(misconception2))
        correction2 = Text("Arrays start from index 0", font="Open Sans", color=green).scale(0.5).to_edge(DL)
        self.play(Write(correction2))
        self.wait(1)
        self.play(FadeOut(correction2))

        misconception3 = Text("Array size cannot be changed after declaration. (Incorrect)", font="Open Sans", color=red).scale(0.5).to_edge(DL)
        self.play(Write(misconception3))
        self.wait(1)
        self.play(FadeOut(misconception3))
        correction3 = Text("Dynamic arrays can be resized", font="Open Sans", color=green).scale(0.5).to_edge(DL)
        self.play(Write(correction3))
        self.wait(1)
        self.play(FadeOut(correction3))

        annotation2 = MarkupText("Arrays store elements of the same type. Elements are accessed using their index.", color=dark_blue).to_edge(DOWN)
        self.play(Write(annotation2)) # Annotation
        self.wait(3)

        self.play(FadeOut(array_box, element_texts, index_texts, element_label, index_label, contiguous_label, annotation2)) # Fadeout

        # 3. Example Application (8 seconds)
        student_ids = ["121", "122", "123", "124", "125"]
        student_array = Rectangle(width=5, height=1, color=blue)
        student_id_texts = VGroup(*[Text(s_id, font="Open Sans", color=green).scale(0.7) for s_id in student_ids]).arrange(RIGHT, buff=0.5)
        student_id_texts.move_to(student_array.get_center()) #Student IDS
        self.play(Create(student_array))
        self.play(Write(student_id_texts))
        self.wait(1)

        highlight_rect = SurroundingRectangle(student_id_texts[2], color=orange) #Highlighting
        self.play(Create(highlight_rect)) # Highlight index 2
        self.wait(1)

        annotation3 = MarkupText("Student IDs stored in an Array.", color=dark_blue).to_edge(DOWN)
        self.play(Write(annotation3)) # Annotation
        self.wait(2)
        self.play(FadeOut(student_array, student_id_texts, highlight_rect, annotation3))

        # 4. Step-by-Step - Accessing Element (18 seconds)
        code_line1 = Text("int arr[] = {10, 20, 30, 40, 50};", font="Open Sans", color=blue).scale(0.6).to_edge(UP)
        code_line2 = Text("Access element at index 2 (arr[2]);", font="Open Sans", color=blue).scale(0.6).next_to(code_line1, DOWN)
        code_line3 = Text("arr[2] returns 30;", font="Open Sans", color=blue).scale(0.6).next_to(code_line2, DOWN)

        self.play(Write(code_line1))
        self.wait(1)
        self.play(Write(code_line2))
        self.wait(1)
        highlight_index = SurroundingRectangle(code_line2[25:28], color=orange)  #Highlight arr[2]
        self.play(Create(highlight_index)) #Highlight the index
        self.wait(1)
        self.play(Write(code_line3)) #Writing the final line

        annotation4 = MarkupText("Accessing element at index 2. arr[2] returns 30.", color=dark_blue).to_edge(DOWN)
        self.play(Write(annotation4))
        self.wait(3)
        self.play(FadeOut(code_line1, code_line2, code_line3, highlight_index, annotation4))

        # 5. Summary (7 seconds)
        summary_text1 = Text("Arrays store similar data.", font="Open Sans", color=green).scale(0.7).move_to(UP)
        summary_text2 = Text("Contiguous memory allocation.", font="Open Sans", color=green).scale(0.7).next_to(summary_text1, DOWN)
        summary_text3 = Text("Elements accessed by index.", font="Open Sans", color=green).scale(0.7).next_to(summary_text2, DOWN)

        self.play(FadeIn(summary_text1))
        self.wait(0.5)
        self.play(FadeIn(summary_text2))
        self.wait(0.5)
        self.play(FadeIn(summary_text3))
        self.wait(1)
        annotation5 = MarkupText("Arrays: Organized, Indexed, and Efficient.", color=dark_blue).to_edge(DOWN)
        self.play(Write(annotation5))
        self.wait(3)
        self.play(FadeOut(summary_text1, summary_text2, summary_text3, annotation5)) #Fading out the summary