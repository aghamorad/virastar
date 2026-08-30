import Capacitor
import AVFoundation
import Speech

// Dictation for the in-app editor. WKWebView has no Web Speech API, so the
// web app asks this plugin (via window.Capacitor.Plugins.VirastarSpeech) to
// run the system speech recognizer instead. Emits `partialResult` events
// while listening and one `end` event when the session finishes.

@objc(VirastarSpeech)
public class VirastarSpeech: CAPPlugin {
    private var recognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    @objc public func isSupported(_ call: CAPPluginCall) {
        let available = SFSpeechRecognizer(locale: Locale(identifier: "fa-IR")) != nil
        call.resolve(["supported": available])
    }

    @objc public func start(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? "fa-IR"
        stopSession()
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
        recognizer?.queue = OperationQueue()

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard status == .authorized else {
                    call.reject("دسترسی به تشخیص گفتار داده نشد")
                    return
                }
                guard let recognizer = self.recognizer, recognizer.isAvailable else {
                    call.reject("تشخیص گفتار در دسترس نیست")
                    return
                }
                do {
                    try self.startSession(recognizer)
                    call.resolve()
                } catch {
                    call.reject("شروع دیکته ناموفق بود: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        stopSession()
        notifyListeners("end", data: ["error": ""])
        call.resolve()
    }

    private func startSession(_ recognizer: SFSpeechRecognizer) throws {
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        request.requiresOnDeviceRecognition = false
        self.request = request

        let audioEngine = AVAudioEngine()
        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }
        audioEngine.prepare()
        try audioEngine.start()
        self.audioEngine = audioEngine

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let text = result.bestTranscription.formattedString
                self.notifyListeners("partialResult", data: ["transcript": text, "isFinal": result.isFinal])
            }
            if error != nil || (result?.isFinal ?? false) {
                let message = error?.localizedDescription ?? ""
                self.stopSession()
                self.notifyListeners("end", data: ["error": message])
            }
        }
    }

    private func stopSession() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
