from manim import *

class BackpropagationExplanation(Scene):
    def construct(self):
        # --- SETUP ---

        # Colors
        neuron_color = BLUE_E
        weight_color = GREEN_D
        bias_color = YELLOW_D
        gradient_color = RED_E
        forward_color = GREEN_A
        backward_color = RED_A

        # Positions and Spacing
        x_start = -6
        x_mid = 0
        x_end = 6
        y_top = 2
        y_mid = 0
        y_bottom = -2
        node_radius = 0.4
        horizontal_spacing = 3
        vertical_spacing = 1.5

        # --- NEURAL NETWORK STRUCTURE ---

        input_layer_nodes = [Circle(radius=node_radius, color=neuron_color, fill_opacity=1).shift(LEFT * horizontal_spacing * 2 + UP * y) for y in [y_top, y_bottom]]
        hidden_layer_nodes = [Circle(radius=node_radius, color=neuron_color, fill_opacity=1).shift(LEFT * horizontal_spacing + UP * y) for y in [y_top, y_mid, y_bottom]]
        output_layer_nodes = [Circle(radius=node_radius, color=neuron_color, fill_opacity=1).shift(RIGHT * horizontal_spacing + UP * y) for y in [y_top, y_bottom]]

        input_labels = [Tex(f"x{i+1}", color=WHITE).scale(0.7).move_to(node.get_center()) for i, node in enumerate(input_layer_nodes)]
        hidden_labels = [Tex(f"h{i+1}", color=WHITE).scale(0.7).move_to(node.get_center()) for i, node in enumerate(hidden_layer_nodes)]
        output_labels = [Tex(f"o{i+1}", color=WHITE).scale(0.7).move_to(node.get_center()) for i, node in enumerate(output_layer_nodes)]

        input_layer_label = Tex("Input Layer").next_to(input_layer_nodes[0], UP)
        hidden_layer_label = Tex("Hidden Layer").next_to(hidden_layer_nodes[0], UP)
        output_layer_label = Tex("Output Layer").next_to(output_layer_nodes[0], UP)

        layers = VGroup(*input_layer_nodes, *hidden_layer_nodes, *output_layer_nodes)
        labels = VGroup(*input_labels, *hidden_labels, *output_labels, input_layer_label, hidden_layer_label, output_layer_label)

        # Weights and Biases (Placeholder - will be animated)
        weights_ih = VGroup() # Input to Hidden weights
        weights_ho = VGroup() # Hidden to Output weights
        biases_h = VGroup()   # Hidden layer biases
        biases_o = VGroup()   # Output layer biases

        # Function Labels (Sigmoid for activation, MSE for Loss)
        sigmoid_func = MathTex(r"\sigma(z) = \frac{1}{1 + e^{-z}}").scale(0.6).to_corner(UR, buff=0.2)
        mse_func = MathTex(r"L = \frac{1}{2} \sum (o_i - y_i)^2").scale(0.6).next_to(sigmoid_func, DOWN, aligned_edge=UR)
        self.add(sigmoid_func, mse_func)

        # --- ANIMATION START ---

        self.play(Create(layers), Write(labels))
        self.wait(1)

        # --- FORWARD PROPAGATION ---
        forward_arrow = CurvedArrow(start_point=input_layer_label.get_left(), end_point=output_layer_label.get_right(), color=forward_color).scale(0.8)
        forward_text = Tex("Forward Propagation", color=forward_color).scale(0.8).next_to(forward_arrow, UP)
        self.play(Create(forward_arrow), Write(forward_text))

        self.wait(1)

        # Input to Hidden Weights and Biases
        weights_biases_text = Tex("Weights and Biases (Initialized Randomly)", color=weight_color).scale(0.7).to_edge(UP)
        self.play(Write(weights_biases_text))
        self.wait(0.5)

        for i_node in input_layer_nodes:
            for h_node in hidden_layer_nodes:
                weight_ij = Line(i_node.get_right(), h_node.get_left(), color=weight_color, stroke_width=2, buff=0.1)
                weight_label = Tex(f"w$_{{{input_layer_nodes.index(i_node)+1}{hidden_layer_nodes.index(h_node)+1}}}$", color=weight_color).scale(0.5).move_to(weight_ij.get_center() + UP * 0.2)
                weights_ih.add(weight_ij, weight_label)
        for h_node in hidden_layer_nodes:
            bias_h = Dot(h_node.get_left() + LEFT * node_radius * 1.5 + DOWN * node_radius * 0.5, color=bias_color, radius=0.08)
            bias_label_h = Tex(f"b$_{{{hidden_layer_nodes.index(h_node)+1}}}$", color=bias_color).scale(0.5).next_to(bias_h, LEFT, buff=0.05)
            biases_h.add(bias_h, bias_label_h)

        self.play(Create(weights_ih), Create(biases_h))
        self.wait(1)

        # Hidden to Output Weights and Biases
        for h_node in hidden_layer_nodes:
            for o_node in output_layer_nodes:
                weight_jk = Line(h_node.get_right(), o_node.get_left(), color=weight_color, stroke_width=2, buff=0.1)
                weight_label = Tex(f"v$_{{{hidden_layer_nodes.index(h_node)+1}{output_layer_nodes.index(o_node)+1}}}$", color=weight_color).scale(0.5).move_to(weight_jk.get_center() + UP * 0.2)
                weights_ho.add(weight_jk, weight_label)
        for o_node in output_layer_nodes:
            bias_o = Dot(o_node.get_left() + LEFT * node_radius * 1.5 + DOWN * node_radius * 0.5, color=bias_color, radius=0.08)
            bias_label_o = Tex(f"c$_{{{output_layer_nodes.index(o_node)+1}}}$", color=bias_color).scale(0.5).next_to(bias_o, LEFT, buff=0.05)
            biases_o.add(bias_o, bias_label_o)

        self.play(Create(weights_ho), Create(biases_o))
        self.wait(1.5)

        # --- Forward Pass Calculation (Simplified) ---
        calculation_box = Rectangle(width=5, height=3, color=BLUE, fill_opacity=0.1).to_edge(DL)
        calculation_text = Tex("Forward Pass Calculations", color=BLUE).scale(0.7).move_to(calculation_box.get_top() + DOWN * 0.3)
        calculation_content = VGroup(calculation_text)

        self.play(Create(calculation_box), Write(calculation_text))
        self.wait(0.5)

        # Example Calculation for h1
        h1_calc_text = MathTex(r"h_1 = \sigma(w_{11}x_1 + w_{21}x_2 + b_1)").scale(0.6)
        h1_calc_text.next_to(calculation_text, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        calculation_content.add(h1_calc_text)
        self.play(Write(h1_calc_text))
        
        # Create VGroups for Indicate animations
        weights_ih_subset = VGroup(weights_ih[0], weights_ih[1])
        input_nodes_group = VGroup(*input_layer_nodes)
        
        self.play(
            Indicate(hidden_layer_nodes[0], color=forward_color),
            Indicate(weights_ih_subset, color=forward_color),
            Indicate(biases_h[0], color=forward_color),
            Indicate(input_nodes_group, color=forward_color)
        )
        self.wait(1)

        # Example Calculation for o1
        o1_calc_text = MathTex(r"o_1 = \sigma(v_{11}h_1 + v_{21}h_2 + v_{31}h_3 + c_1)").scale(0.6)
        o1_calc_text.next_to(h1_calc_text, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        calculation_content.add(o1_calc_text)
        self.play(Write(o1_calc_text))
        
        # Create VGroups for Indicate animations
        weights_ho_subset = VGroup(weights_ho[0], weights_ho[1], weights_ho[2])
        hidden_nodes_group = VGroup(*hidden_layer_nodes)
        
        self.play(
            Indicate(output_layer_nodes[0], color=forward_color),
            Indicate(weights_ho_subset, color=forward_color),
            Indicate(biases_o[0], color=forward_color),
            Indicate(hidden_nodes_group, color=forward_color)
        )
        self.wait(1.5)

        self.play(FadeOut(calculation_content), Uncreate(calculation_box))
        self.play(FadeOut(forward_arrow), FadeOut(forward_text))
        self.wait(0.5)

        # --- BACKWARD PROPAGATION ---
        backward_arrow = CurvedArrow(start_point=output_layer_label.get_right(), end_point=input_layer_label.get_left(), color=backward_color).scale(0.8)
        backward_text = Tex("Backward Propagation (Gradient Descent)", color=backward_color).scale(0.8).next_to(backward_arrow, UP)
        self.play(Create(backward_arrow), Write(backward_text))
        self.wait(1)

        loss_calculation_box = Rectangle(width=5, height=2, color=RED, fill_opacity=0.1).to_edge(DR)
        loss_calculation_text = Tex("Loss Calculation (MSE)", color=RED).scale(0.7).move_to(loss_calculation_box.get_top() + DOWN * 0.3)
        loss_value = MathTex("L = ?", color=RED).scale(0.8).next_to(loss_calculation_text, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        loss_group = VGroup(loss_calculation_box, loss_calculation_text, loss_value)
        self.play(Create(loss_calculation_box), Write(loss_calculation_text))
        self.play(Write(loss_value))
        self.wait(1)

        # Error at Output Layer (dL/do)
        output_gradient_labels = VGroup()
        for o_node in output_layer_nodes:
            grad_o_label = MathTex(r"\frac{\partial L}{\partial o_{" + str(output_layer_nodes.index(o_node)+1) + r"}}", color=gradient_color).scale(0.6).next_to(o_node, RIGHT)
            output_gradient_labels.add(grad_o_label)
            self.play(Write(grad_o_label), Indicate(o_node, color=gradient_color))
            self.wait(0.3)
        self.wait(0.5)

        # Gradient of Output layer before activation (dL/dz_o) - Example for o1
        z_o1_gradient_label = MathTex(r"\frac{\partial L}{\partial z_{o1}} = \frac{\partial L}{\partial o_1} \cdot \sigma'(z_{o1})", color=gradient_color).scale(0.6).next_to(output_gradient_labels[0], RIGHT, buff=0.5)
        self.play(Write(z_o1_gradient_label), Indicate(output_layer_nodes[0], color=gradient_color))
        self.wait(1)

        # Gradients for weights from Hidden to Output (dL/dv) - Example for v11
        v11_gradient_label = MathTex(r"\frac{\partial L}{\partial v_{11}} = \frac{\partial L}{\partial z_{o1}} \cdot h_1", color=gradient_color).scale(0.6).next_to(z_o1_gradient_label, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        self.play(Write(v11_gradient_label), Indicate(weights_ho[0], color=gradient_color), Indicate(hidden_layer_nodes[0], color=gradient_color), Indicate(output_layer_nodes[0], color=gradient_color))
        self.wait(1)

        # Gradients for biases of Output layer (dL/dc) - Example for c1
        c1_gradient_label = MathTex(r"\frac{\partial L}{\partial c_{1}} = \frac{\partial L}{\partial z_{o1}}", color=gradient_color).scale(0.6).next_to(v11_gradient_label, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        self.play(Write(c1_gradient_label), Indicate(biases_o[0], color=gradient_color), Indicate(output_layer_nodes[0], color=gradient_color))
        self.wait(1)

        self.play(FadeOut(z_o1_gradient_label), FadeOut(v11_gradient_label), FadeOut(c1_gradient_label))
        self.wait(0.5)

        # Backpropagate to Hidden Layer - Error at Hidden Layer (dL/dh) - Example for h1
        h1_gradient_label = MathTex(r"\frac{\partial L}{\partial h_{1}} = \sum_{k} \frac{\partial L}{\partial z_{ok}} \cdot v_{1k}", color=gradient_color).scale(0.6).next_to(hidden_layer_nodes[0], LEFT)
        
        # Create VGroup for Indicate animation
        weights_ho_subset2 = VGroup(weights_ho[0], weights_ho[3])
        output_nodes_group = VGroup(*output_layer_nodes)
        
        self.play(Write(h1_gradient_label), 
                 Indicate(hidden_layer_nodes[0], color=gradient_color), 
                 Indicate(weights_ho_subset2, color=gradient_color), 
                 Indicate(output_nodes_group, color=gradient_color))
        self.wait(1.5)

        # Gradient of Hidden layer before activation (dL/dz_h) - Example for h1
        z_h1_gradient_label = MathTex(r"\frac{\partial L}{\partial z_{h1}} = \frac{\partial L}{\partial h_1} \cdot \sigma'(z_{h1})", color=gradient_color).scale(0.6).next_to(h1_gradient_label, LEFT, buff=0.5)
        self.play(Write(z_h1_gradient_label), Indicate(hidden_layer_nodes[0], color=gradient_color))
        self.wait(1)

        # Gradients for weights from Input to Hidden (dL/dw) - Example for w11
        w11_gradient_label = MathTex(r"\frac{\partial L}{\partial w_{11}} = \frac{\partial L}{\partial z_{h1}} \cdot x_1", color=gradient_color).scale(0.6).next_to(z_h1_gradient_label, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        self.play(Write(w11_gradient_label), Indicate(weights_ih[0], color=gradient_color), Indicate(input_layer_nodes[0], color=gradient_color), Indicate(hidden_layer_nodes[0], color=gradient_color))
        self.wait(1)

        # Gradients for biases of Hidden layer (dL/db) - Example for b1
        b1_gradient_label = MathTex(r"\frac{\partial L}{\partial b_{1}} = \frac{\partial L}{\partial z_{h1}}", color=gradient_color).scale(0.6).next_to(w11_gradient_label, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        self.play(Write(b1_gradient_label), Indicate(biases_h[0], color=gradient_color), Indicate(hidden_layer_nodes[0], color=gradient_color))
        self.wait(1.5)

        self.play(FadeOut(h1_gradient_label), FadeOut(z_h1_gradient_label), FadeOut(w11_gradient_label), FadeOut(b1_gradient_label))
        self.play(FadeOut(output_gradient_labels), FadeOut(loss_group))
        self.wait(0.5)

        # --- Weight Update ---
        update_box = Rectangle(width=5, height=2, color=GREEN, fill_opacity=0.1).to_edge(DR)
        update_text = Tex("Weight Update", color=GREEN).scale(0.7).move_to(update_box.get_top() + DOWN * 0.3)
        update_rule = MathTex(r"w_{new} = w_{old} - \alpha \frac{\partial L}{\partial w}", color=GREEN).scale(0.6).next_to(update_text, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        update_group = VGroup(update_box, update_text, update_rule)
        self.play(Create(update_box), Write(update_text))
        self.play(Write(update_rule))
        self.wait(1)

        # Example weight update (w11)
        w11_update_example = MathTex(r"w_{11}^{new} = w_{11}^{old} - \alpha \frac{\partial L}{\partial w_{11}}", color=GREEN).scale(0.6).next_to(update_rule, DOWN, aligned_edge=LEFT).shift(DOWN * 0.2)
        self.play(Write(w11_update_example), Indicate(weights_ih[0], color=GREEN))
        self.wait(1.5)

        self.play(FadeOut(update_group), FadeOut(w11_update_example))
        self.play(FadeOut(backward_arrow), FadeOut(backward_text), FadeOut(weights_biases_text))
        self.wait(0.5)

        # Iteration and Convergence
        iteration_text_group = VGroup(
            Tex("Repeat Forward and Backward Propagation", color=BLUE).scale(0.8),
            Tex("for multiple iterations (epochs).", color=BLUE).scale(0.8),
            Tex("Loss will gradually decrease.", color=GREEN).scale(0.8)
        ).arrange(DOWN).move_to(ORIGIN)
        self.play(Write(iteration_text_group))
        self.wait(2)

        self.play(*[FadeOut(mob) for mob in self.mobjects]) # Fade out all objects for clean ending
        self.wait(1)