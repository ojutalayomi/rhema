#!/usr/bin/env python3
"""
Entry point for optimum-cli ONNX export with a torch.rms_norm polyfill.

PyTorch macOS x86_64 wheels top out at 2.2.x, but Optimum's ONNX exporter
expects torch.rms_norm (PyTorch 2.4+). Without this shim, importing
optimum.exporters.onnx fails at module load time.

Usage (same as optimum-cli):
  python data/export-onnx-model.py export onnx --model ID --task TASK OUTPUT_DIR

Do not import optimum before _apply_torch_rms_norm_shim().
"""

from __future__ import annotations

import sys


def _apply_torch_rms_norm_shim() -> None:
    import torch

    if hasattr(torch, "rms_norm"):
        return

    def rms_norm(input, normalized_shape, weight=None, eps=None):
        if eps is None:
            eps = torch.finfo(input.dtype).eps
        axis = -len(normalized_shape)
        mean_square = torch.mean(torch.square(input), dim=axis, keepdim=True)
        rms = torch.sqrt(mean_square + eps)
        output = input / rms
        if weight is not None:
            output = output * weight
        return output

    torch.rms_norm = rms_norm


_apply_torch_rms_norm_shim()

from optimum.commands.optimum_cli import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())
