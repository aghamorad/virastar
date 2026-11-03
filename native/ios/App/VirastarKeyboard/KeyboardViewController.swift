import UIKit
import Speech
import AVFoundation

/// Virastar iOS Custom Keyboard Extension
/// Provides a senior-friendly Persian keyboard layout, 1-tap half-space,
/// dictation, and the magic "✨ ویرایش هوشمند" button right inside any app
/// (WhatsApp, Telegram, Notes, Mail, etc.).
class KeyboardViewController: UIInputViewController {

    private var nextKeyboardButton: UIButton!
    private var topBarView: UIScrollView!
    private var keyboardContainer: UIStackView!
    private var activeMode: String = "اصلاح"
    private var isEditingLive = false

    private let modes = ["اصلاح", "رسمی", "اداری", "حقوقی", "خودمانی", "لاتی", "دیوانی"]

    private let row1 = ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "چ"]
    private let row2 = ["ش", "س", "ی", "ب", "ل", "ا", "ت", "ن", "م", "ک", "گ"]
    private let row3 = ["ظ", "ط", "ز", "ر", "ذ", "د", "پ", "و", "ژ"]

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func updateViewConstraints() {
        super.updateViewConstraints()
    }

    private func setupUI() {
        view.backgroundColor = UIColor(red: 0.96, green: 0.94, blue: 0.88, alpha: 1.0) // Warm paper background

        let mainStack = UIStackView()
        mainStack.axis = .vertical
        mainStack.spacing = 6
        mainStack.distribution = .fill
        mainStack.alignment = .fill
        mainStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(mainStack)

        NSLayoutConstraint.activate([
            mainStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 6),
            mainStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -6),
            mainStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
            mainStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4)
        ])

        // 1. Top Assistant & Mode Bar
        let assistantBar = createAssistantBar()
        mainStack.addArrangedSubview(assistantBar)

        // 2. Keyboard Rows
        let kbdStack = UIStackView()
        kbdStack.axis = .vertical
        kbdStack.spacing = 6
        kbdStack.distribution = .fillEqually
        kbdStack.alignment = .fill
        mainStack.addArrangedSubview(kbdStack)

        // Row 1
        kbdStack.addArrangedSubview(createRowStack(chars: row1))

        // Row 2
        kbdStack.addArrangedSubview(createRowStack(chars: row2))

        // Row 3 (with Backspace)
        let row3Stack = createRowStack(chars: row3)
        let backspaceBtn = createSpecialButton(title: "⌫", action: #selector(handleBackspace))
        backspaceBtn.widthAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        row3Stack.insertArrangedSubview(backspaceBtn, at: 0)
        kbdStack.addArrangedSubview(row3Stack)

        // Row 4: Globe, Half-space, Space, Comma, Period, Return
        let row4Stack = UIStackView()
        row4Stack.axis = .horizontal
        row4Stack.spacing = 5
        row4Stack.distribution = .fill
        row4Stack.alignment = .fill

        // Globe / Next Keyboard
        nextKeyboardButton = UIButton(type: .system)
        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = UIFont.systemFont(ofSize: 20)
        nextKeyboardButton.backgroundColor = UIColor(white: 1.0, alpha: 0.85)
        nextKeyboardButton.layer.cornerRadius = 8
        nextKeyboardButton.translatesAutoresizingMaskIntoConstraints = false
        nextKeyboardButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        nextKeyboardButton.heightAnchor.constraint(equalToConstant: 44).isActive = true
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        row4Stack.addArrangedSubview(nextKeyboardButton)

        // Half-space (نیم‌فاصله)
        let zwnjBtn = createSpecialButton(title: "نیم‌فاصله", action: #selector(handleHalfSpace))
        zwnjBtn.setTitleColor(UIColor(red: 0.72, green: 0.28, blue: 0.22, alpha: 1.0), for: .normal) // Brand color
        zwnjBtn.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        zwnjBtn.widthAnchor.constraint(equalToConstant: 68).isActive = true
        row4Stack.addArrangedSubview(zwnjBtn)

        // Spacebar
        let spaceBtn = createKeyButton(title: "فاصله")
        spaceBtn.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        spaceBtn.setContentHuggingPriority(.defaultLow, for: .horizontal)
        row4Stack.addArrangedSubview(spaceBtn)

        // Comma
        let commaBtn = createKeyButton(title: "،")
        commaBtn.widthAnchor.constraint(equalToConstant: 38).isActive = true
        row4Stack.addArrangedSubview(commaBtn)

        // Period
        let dotBtn = createKeyButton(title: ".")
        dotBtn.widthAnchor.constraint(equalToConstant: 38).isActive = true
        row4Stack.addArrangedSubview(dotBtn)

        // Return / Newline
        let returnBtn = createSpecialButton(title: "↵", action: #selector(handleReturn))
        returnBtn.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .bold)
        returnBtn.widthAnchor.constraint(equalToConstant: 46).isActive = true
        row4Stack.addArrangedSubview(returnBtn)

        kbdStack.addArrangedSubview(row4Stack)
    }

    private func createAssistantBar() -> UIView {
        let bar = UIView()
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.heightAnchor.constraint(equalToConstant: 40).isActive = true

        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 6
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        bar.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: bar.topAnchor),
            stack.bottomAnchor.constraint(equalTo: bar.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: bar.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: bar.trailingAnchor)
        ])

        // Magic Edit Button (✨ ویرایش هوشمند)
        let magicBtn = UIButton(type: .system)
        magicBtn.setTitle("✨ ویرایش با ویراستار", for: .normal)
        magicBtn.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .black)
        magicBtn.backgroundColor = UIColor(red: 0.72, green: 0.28, blue: 0.22, alpha: 1.0)
        magicBtn.setTitleColor(.white, for: .normal)
        magicBtn.layer.cornerRadius = 10
        magicBtn.contentEdgeInsets = UIEdgeInsets(top: 6, left: 10, bottom: 6, right: 10)
        magicBtn.addTarget(self, action: #selector(handleMagicEdit), for: .touchUpInside)
        stack.addArrangedSubview(magicBtn)

        // Scrollable Mode Pills
        let scroll = UIScrollView()
        scroll.showsHorizontalScrollIndicator = false
        let modeStack = UIStackView()
        modeStack.axis = .horizontal
        modeStack.spacing = 5
        modeStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(modeStack)

        NSLayoutConstraint.activate([
            modeStack.topAnchor.constraint(equalTo: scroll.topAnchor),
            modeStack.bottomAnchor.constraint(equalTo: scroll.bottomAnchor),
            modeStack.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
            modeStack.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            modeStack.heightAnchor.constraint(equalTo: scroll.heightAnchor)
        ])

        for m in modes {
            let btn = UIButton(type: .system)
            btn.setTitle(m, for: .normal)
            btn.titleLabel?.font = UIFont.systemFont(ofSize: 12, weight: .bold)
            btn.setTitleColor(m == activeMode ? UIColor(red: 0.72, green: 0.28, blue: 0.22, alpha: 1.0) : .darkGray, for: .normal)
            btn.backgroundColor = m == activeMode ? UIColor(white: 1.0, alpha: 0.95) : UIColor(white: 1.0, alpha: 0.6)
            btn.layer.cornerRadius = 8
            btn.contentEdgeInsets = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
            btn.addTarget(self, action: #selector(modeSelected(_:)), for: .touchUpInside)
            modeStack.addArrangedSubview(btn)
        }

        stack.addArrangedSubview(scroll)
        return bar
    }

    @objc private func modeSelected(_ sender: UIButton) {
        guard let title = sender.currentTitle else { return }
        activeMode = title
        // Update styling
        if let modeStack = sender.superview as? UIStackView {
            for case let btn as UIButton in modeStack.arrangedSubviews {
                let isSelected = btn.currentTitle == activeMode
                btn.setTitleColor(isSelected ? UIColor(red: 0.72, green: 0.28, blue: 0.22, alpha: 1.0) : .darkGray, for: .normal)
                btn.backgroundColor = isSelected ? UIColor(white: 1.0, alpha: 0.95) : UIColor(white: 1.0, alpha: 0.6)
            }
        }
    }

    private func createRowStack(chars: [String]) -> UIStackView {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 4
        stack.distribution = .fillEqually
        stack.alignment = .fill
        for ch in chars {
            stack.addArrangedSubview(createKeyButton(title: ch))
        }
        return stack
    }

    private func createKeyButton(title: String) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.setTitleColor(.black, for: .normal)
        btn.titleLabel?.font = UIFont.systemFont(ofSize: 19, weight: .semibold)
        btn.backgroundColor = .white
        btn.layer.cornerRadius = 8
        btn.layer.shadowColor = UIColor.black.cgColor
        btn.layer.shadowOpacity = 0.12
        btn.layer.shadowRadius = 1
        btn.layer.shadowOffset = CGSize(width: 0, height: 1)
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        btn.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        return btn
    }

    private func createSpecialButton(title: String, action: Selector) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.setTitleColor(.black, for: .normal)
        btn.backgroundColor = UIColor(white: 0.92, alpha: 1.0)
        btn.layer.cornerRadius = 8
        btn.translatesAutoresizingMaskIntoConstraints = false
        btn.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        btn.addTarget(self, action: action, for: .touchUpInside)
        return btn
    }

    @objc private func keyTapped(_ sender: UIButton) {
        guard let title = sender.currentTitle else { return }
        let textToInsert = title == "فاصله" ? " " : title
        textDocumentProxy.insertText(textToInsert)
    }

    @objc private func handleBackspace() {
        textDocumentProxy.deleteBackward()
    }

    @objc private func handleHalfSpace() {
        textDocumentProxy.insertText("\u{200C}")
    }

    @objc private func handleReturn() {
        textDocumentProxy.insertText("\n")
    }

    @objc private func handleMagicEdit() {
        guard !isEditingLive else { return }
        let proxy = textDocumentProxy

        // 1. Get the current text before cursor (or line)
        let before = proxy.documentContextBeforeInput ?? ""
        guard !before.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        isEditingLive = true

        // 2. Apply fast Persian normalization & punctuation
        let polished = polishPersianText(before, mode: activeMode)

        // 3. Delete existing text and insert polished text
        let countToDelete = before.count
        for _ in 0..<countToDelete {
            proxy.deleteBackward()
        }
        proxy.insertText(polished)

        isEditingLive = false
    }

    /// Fast, offline Persian punctuation and typography normalizer
    private func polishPersianText(_ input: String, mode: String) -> String {
        var text = input

        // 1. Standardize Persian characters
        text = text.replacingOccurrences(of: "ي", with: "ی")
        text = text.replacingOccurrences(of: "ك", with: "ک")
        text = text.replacingOccurrences(of: "ۀ", with: "ه‌ی")

        // 2. Fix common prefixes/suffixes with Half-space (\u{200C})
        text = text.replacingOccurrences(of: "\\bمی ", with: "می\u{200C}", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\bنمی ", with: "نمی\u{200C}", options: .regularExpression)
        text = text.replacingOccurrences(of: " ها\\b", with: "\u{200C}ها", options: .regularExpression)
        text = text.replacingOccurrences(of: " های\\b", with: "\u{200C}های", options: .regularExpression)
        text = text.replacingOccurrences(of: " تر\\b", with: "\u{200C}تر", options: .regularExpression)
        text = text.replacingOccurrences(of: " ترین\\b", with: "\u{200C}ترین", options: .regularExpression)

        // 3. Fix Persian punctuation spacing
        text = text.replacingOccurrences(of: " +([،؛:!؟\\.])", with: "$1", options: .regularExpression)
        text = text.replacingOccurrences(of: "([،؛:!؟])([^ \\n])", with: "$1 $2", options: .regularExpression)

        // 4. Strict sentence-ending period guarantee
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            let lastChar = trimmed.last!
            if lastChar != "." && lastChar != "!" && lastChar != "؟" && lastChar != ":" {
                text = trimmed + "."
            }
        }

        return text
    }
}
