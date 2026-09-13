import Foundation
import CoreImage
import CoreGraphics
let source = CIImage(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))!
let width = Int(source.extent.width), height = Int(source.extent.height)
let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!
ctx.setFillColor(gray: 1, alpha: 1)
ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: 440+x, y: CGFloat(height)-330-y) }
let path = CGMutablePath()
path.move(to: p(45, 60))
path.addCurve(to: p(56, 106), control1: p(35, 77), control2: p(39, 98))
path.addLine(to: p(66, 108))
path.addCurve(to: p(45, 60), control1: p(55, 91), control2: p(48, 75))
path.closeSubpath()
ctx.setFillColor(gray: 0, alpha: 1)
ctx.addPath(path); ctx.fillPath()
let mask = CIImage(cgImage: ctx.makeImage()!)
let result = source.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: source.extent), kCIInputMaskImageKey: mask])
try CIContext().writePNGRepresentation(of: result, to: URL(fileURLWithPath: CommandLine.arguments[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
