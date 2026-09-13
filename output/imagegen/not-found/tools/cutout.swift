import Foundation
import Vision
import CoreImage
import ImageIO

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let handler = VNImageRequestHandler(url: input)
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let observation = request.results?.first, !observation.allInstances.isEmpty else { fatalError("No foreground detected") }
let buffer = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
let mask = CIImage(cvPixelBuffer: buffer).applyingFilter("CIMorphologyMinimum", parameters: ["inputRadius": 8.0])
let source = CIImage(contentsOf: input)!
let clear = CIImage(color: .clear).cropped(to: source.extent)
let result = source.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: mask])
let context = CIContext()
try context.writePNGRepresentation(of: result, to: output, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("Saved alpha PNG; foreground instances: \(observation.allInstances.count)")
