from sympy.solvers import ode
from sympy import Function, Derivative
from sympy.abc import t
x = Function('x',t)
x__ = Derivative(x, 2)
eq = s